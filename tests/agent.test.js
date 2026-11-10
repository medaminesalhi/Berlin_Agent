import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRobots,RobotsPolicy} from '../src/robots.js';
import {extractDirectoryLinks,detectPaginationLinks,browseCompany,browseDirectory,selectBestEvidencePages} from '../src/browser-agent.js';
import {deduplicate,scoreLead} from '../src/scoring.js';
import {checkAIResponse,queryGroq} from '../src/groq.js';
import {mapOsmElement} from '../src/discovery.js';
import {resultToCandidate} from '../src/searxng.js';
import {exportResults} from '../src/export.js';
import {readSites} from '../src/utils.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('robots : interdit /private mais autorise /public',()=>{
 const f=parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/public\n');
 assert.equal(f('https://company.de/private/page'),false);
 assert.equal(f('https://company.de/private/public'),true);
 assert.equal(f('https://company.de/kontakt'),true);
});
test('robots : 403 site ignore sans aucune navigation',async()=>{
 const f=new RobotsPolicy({fetchImpl:async()=>({status:403}),delayMs:0});
 assert.equal(await f.allowed('https://company.de/kontakt'),false);
});
test('robots : politique connue et cachee',async()=>{
 let calls=0;const f=new RobotsPolicy({fetchImpl:async()=>{calls++;return {status:200,ok:true,text:async()=> 'User-agent: *\nDisallow: /admin'}},delayMs:0});
 assert.equal(await f.allowed('https://company.de/admin'),false);
 assert.equal(await f.allowed('https://company.de/kontakt'),true);
 assert.equal(calls,1);
});
test('SearXNG annuaires exclus des entreprises',()=>{
 assert.equal(resultToCandidate({title:'Hausverwaltung Berlin',url:'https://www.gelbeseiten.de/branchen/hausverwaltung/berlin'}),null);
 assert.ok(resultToCandidate({title:'Erika Hausverwaltung Berlin',url:'https://erika-verwaltung.de/'}));
});
test('OSM mappe entreprise avec source explicite',()=>{
 const row=mapOsmElement({id:1,type:'node',tags:{name:'Firma',website:'https://firma.de','addr:city':'Berlin','addr:street':'Hauptstrasse'}});
 assert.equal(row.name,'Firma');assert.match(row.source_url,/openstreetmap/);
});
test('annuaires : extraire domaines externes et eviter Facebook',()=>{
 const links=[{href:'https://f1-hausverwaltung.de/',text:'Firma Hausverwaltung Berlin'}, {href:'https://facebook.com/Firma',text:'Hausverwaltung Berlin'}, {href:'/seite-2',text:'Next'}];
 const res=extractDirectoryLinks(links,'https://vdiv-bb.de/mitglieder/',30);
 assert.equal(res.length,1);assert.match(res[0].website,/f1-hausverwaltung/);
});
test('pagination : liens prochains sur meme domaine',()=>{
 const l=[{href:'/mitglieder?page=2',text:'Weiter'}, {href:'https://other.de',text:'Next'}];
 assert.deepEqual(detectPaginationLinks(l,'https://example.de/mitglieder'),['https://example.de/mitglieder?page=2']);
});
const fakeSnapshots={
 'https://haus-berlin.de/':{title:'Firma Berlin Hausverwaltung',text:'Wir sind Hausverwaltung in Berlin und betreuen WEG-Verwaltung.',links:[{href:'https://haus-berlin.de/kontakt',text:'Kontakt'},{href:'https://haus-berlin.de/ueber-uns',text:'Über uns'}],emails:[],phones:[]},
 'https://haus-berlin.de/kontakt':{title:'Kontakt',text:'Kontakt: 10115 Berlin',links:[],emails:['kontakt@haus-berlin.de'],phones:['+4930123456']},
 'https://haus-berlin.de/ueber-uns':{title:'Über uns',text:'Wir betreuen 1200 Wohneinheiten.',links:[],emails:[],phones:[]}
};
function browserMock(){
 let current='https://haus-berlin.de/';
 return {page:{goto:async(url)=>{if(!fakeSnapshots[url])throw Error('not found');current=url;},url:()=>current,evaluate:async()=>({...fakeSnapshots[current],raw_url:current})},stagehand:{extract:async()=>({})}};
}
test('vraie logique de navigation : ouvre accueil, Kontakt et Über uns',async()=>{
 const result=await browseCompany(browserMock(),{name:'Firma',website:'https://haus-berlin.de/'},{robots:{allowed:async()=>true},stagehandAI:false,delayMs:0,maxPages:4});
 assert.equal(result.documents_visited,3); assert.equal(result.email,'kontakt@haus-berlin.de');
 assert.equal(result.phone,'+4930123456');assert.match(result.page_text,/1200 Wohneinheiten/);
 assert.equal(result.scrape_status,'OK');
});
test('navigation : robots refus entraine statut bloque',async()=>{
 const result=await browseCompany(browserMock(),{name:'Firma',website:'https://haus-berlin.de/'},{robots:{allowed:async()=>false},stagehandAI:false,delayMs:0});
 assert.equal(result.scrape_status,'blocked_by_robots');
});
test('Groq : accepte uniquement preuve textuelle, refuse nombre invente',()=>{
 const pageText='Wir betreuen 1200 Wohneinheiten in Berlin und bieten Mietverwaltung.';
 const validated=checkAIResponse({management_type:'residential',units_managed:1200,units_evidence:'1200 Wohneinheiten',type_evidence:'Mietverwaltung'},pageText);
 assert.equal(validated.units_managed,1200);assert.equal(validated.management_type,'residential');
 const fake=checkAIResponse({management_type:'residential',units_managed:9000,units_evidence:'9000 Wohneinheiten',type_evidence:'Mietverwaltung'},pageText);
 assert.equal(fake.units_managed,null);
});
test('Groq : extraction JSON avec API mockee (aucune cle reelle)',async()=>{
 let called=0;
 const fakeFetch=async()=>{called++;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({management_type:'residential',units_managed:1200,units_evidence:'1200 Wohneinheiten',type_evidence:'Mietverwaltung',reason:'Gestion de logements',decision_maker:null})}}]})}};
 const r=await queryGroq({name:'Firma',website:'https://haus-berlin.de',page_text:'1200 Wohneinheiten, Mietverwaltung in Berlin'},{fetchImpl:fakeFetch,apiKey:'testing-only'});
 assert.equal(called,1);assert.equal(r.units_managed,1200);
});
test('lead scoring : ne penalise pas les informations inconnues comme zero',()=>{
 const a=scoreLead({name:'A',management_type:'residential',units_managed:null,berlin_presence:true,email:null,phone:null});
 assert.equal(a.score_min,55);assert.equal(a.score_max,100);
});
test('dedoublonnage : fusionne par domaine',()=>{
 const v=deduplicate([{name:'A',website:'https://f.de',phone:null,source_url:'OSM'}, {name:'A GmbH',website:'https://www.f.de/kontakt',phone:'123',source_url:'SearX'}]);
 assert.equal(v.length,1);assert.equal(v[0].phone,'123');assert.match(v[0].source_url,/SearX/);
});
test('export : CSV/JSON utiles et aucune formule injectee dans Excel',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'heidi-tests-'));
 const {csvFile,jsonFile}=exportResults([{name:'=HYPERLINK("https://bad.example")',website:'https://firm.de',source_url:'https://openstreetmap.org/1'}],folder,'test');
 assert.ok(fs.existsSync(csvFile));assert.ok(fs.existsSync(jsonFile));
 assert.match(fs.readFileSync(csvFile,'utf8'),/"'=HYPERLINK/);
});
test('CSV de sites reels a le bon format',()=>{
 const sites=readSites('fixtures/sites_berlin.csv');
 assert.ok(sites.length>=8);assert.ok(sites.every(s=>s.website?.startsWith('https://')));
});
