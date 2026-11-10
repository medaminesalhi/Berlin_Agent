#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import { loadEnv, clean, normalizeUrl, readSites, sleep } from './utils.js';
import { discoverBerlin } from './discovery.js';
import { discoverSearxng } from './searxng.js';
import { deduplicate, scoreLead } from './scoring.js';
import { queryGroq } from './groq.js';
import { exportResults } from './export.js';
import { writeReport } from './report.js';
import { RobotsPolicy } from './robots.js';
import { startBrowser, browseCompany, browseDirectory } from './browser-agent.js';
loadEnv();
const args=process.argv.slice(2);
function flag(name,def){const i=args.indexOf('--'+name);return i<0?def:(args[i+1]&&!args[i+1].startsWith('--')?args[i+1]:true);}
function intFlag(name,def,min=1,max=1000){return Math.max(min,Math.min(max,Number.parseInt(flag(name,def),10)||def));}
const opts={mode:flag('mode','research'),limit:intFlag('limit',60),maxPages:intFlag('max-pages',4,1,10),
  searchPages:intFlag('search-pages',2,1,10),searchLimit:intFlag('search-limit',140,1,1000),
  input:flag('input','fixtures/sites_berlin.csv'),deep:!args.includes('--no-deep'),
  directories:args.includes('--directories'), ai:!args.includes('--no-ai'), stagehandAI:!args.includes('--no-stagehand-ai'),
  output:flag('output','output'), delay:intFlag('delay',1100,200,10000)};
const logger={warn:s=>console.warn('⚠ '+s),log:s=>console.log(s)};
function mergeCandidate(lead){
  return {...lead,website:normalizeUrl(lead.website||''),source_pages:lead.source_pages||[],
    management_type:lead.management_type??null,units_managed:lead.units_managed??null,
    berlin_presence:lead.berlin_presence??null,validation_status:lead.validation_status||'TO_VERIFY'};
}
function saveCheckpoint(items,output){
  fs.mkdirSync(output,{recursive:true});
  const file=path.join(output,'checkpoint_latest.json');
  fs.writeFileSync(file,JSON.stringify({saved_at:new Date().toISOString(),count:items.length,items},null,2));
}
function info(line){console.log(`\n${line}`);}

export async function run(){
  info('HEIDI SYSTEMS | STAGEHAND RESEARCH AGENT | BERLIN');
  console.log('Mode:',opts.mode,'Limite:',opts.limit,'Scraping navigateur:',opts.deep?'OUI':'NON','Groq:',opts.ai?'OUI':'NON');
  let leads=[];
  if(opts.mode==='sites'){
    leads=readSites(String(opts.input)).map(mergeCandidate);
    console.log(`Sites connus : ${leads.length}`);
  }else if(opts.mode==='research'){
    // Two independent discovery channels (failure of one doesn't kill another).
    try{
      const osm=await discoverBerlin({limit:opts.searchLimit});
      console.log(`OpenStreetMap : ${osm.length} entreprises candidates`);
      leads.push(...osm.map(mergeCandidate));
    }catch(e){logger.warn(e.message);}
    if(process.env.SEARXNG_URL){
      try{
        const web=await discoverSearxng({baseUrl:process.env.SEARXNG_URL,limit:opts.searchLimit,pages:opts.searchPages,logger});
        console.log(`SearXNG : ${web.length} sites candidats`);
        leads.push(...web.map(mergeCandidate));
      }catch(e){logger.warn('SearXNG: '+e.message);}
    }else logger.warn('SearXNG non configure. Pour une recherche complexe, active docker-searxng.');
  }else throw Error('Mode invalide: utilise --mode research ou --mode sites');
  leads=deduplicate(leads);
  console.log(`Candidats uniques apres decouverte : ${leads.length}`);
  if(!leads.length)throw Error('Aucun candidat. Active SearXNG ou lance --mode sites pour tester les sites de depart.');
  const researchCount=leads.length;
  if(opts.deep){
    let browser;
    const robots=new RobotsPolicy({agent:'BerlinPropertyResearch',delayMs:opts.delay,logger});
    try{
      browser=await startBrowser();
      console.log('Stagehand Chromium : DEMARRE');
      // Directory exploration is opt-in. It may be forbidden on some sites.
      if(opts.directories){
        const directories=fs.readFileSync('fixtures/directories.txt','utf8').split(/\r?\n/).map(s=>s.trim()).filter(x=>x&&!x.startsWith('#'));
        for(const link of directories){
          try{
            const discovered=await browseDirectory(browser,link,{robots,maxPages:opts.searchPages,delayMs:opts.delay,logger});
            console.log(`Annuaire ${link}: ${discovered.length} candidats externes`);
            leads.push(...discovered.map(mergeCandidate));
          }catch(e){logger.warn(`Annuaire non traite ${link}: ${e.message}`);}
        }
        leads=deduplicate(leads);
      }
      // Prioritise candidates with URLs. Unknown websites remain in results.
      const withWebsite=leads.map((x,i)=>({x,i})).filter(({x})=>x.website);
      const groups={searx:[],osm:[],directory:[],other:[]};
      for(const item of withWebsite){const source=String(item.x.discovery_source||'');
        if(source.includes('SearX'))groups.searx.push(item);
        else if(source.includes('directory'))groups.directory.push(item);
        else if(String(item.x.source_url||'').includes('openstreetmap.org'))groups.osm.push(item);
        else groups.other.push(item);
      }
      const eligible=[]; const used=new Set();
      for(let round=0;eligible.length<opts.limit;round++){
        let progress=false;
        for(const group of [groups.searx,groups.directory,groups.osm,groups.other]){
          if(group[round]&&!used.has(group[round].i)){eligible.push(group[round]);used.add(group[round].i);progress=true;}
          if(eligible.length>=opts.limit)break;
        }
        if(!progress)break;
      }
      console.log(`Sites a explorer dans Chromium: ${eligible.length} / ${leads.length}`);
      let checked=0;
      for(const {x,i} of eligible){
        console.log(`[${checked+1}/${eligible.length}] ${x.name}: ${x.website}`);
        try{
          let row=await browseCompany(browser,x,{robots,maxPages:opts.maxPages,stagehandAI:opts.ai&&opts.stagehandAI,delayMs:opts.delay,logger});
          if(opts.ai&&process.env.GROQ_API_KEY&&row.scrape_status==='OK'){
            row=await queryGroq(row);
          }else if(opts.ai&&!process.env.GROQ_API_KEY){row.ai_validation='MISSING_GROQ_KEY';}
          leads[i]=row;
          console.log(` -> ${row.scrape_status}, pages=${row.documents_visited||0}, IA=${row.ai_validation||'NOT_RUN'}`);
        }catch(e){leads[i]={...x,scrape_status:'FAILED',error:e.message};logger.warn(e.message);}
        checked++;
        saveCheckpoint(leads,opts.output);
      }
    } finally {if(browser)await browser.close();}
  }
  const final=deduplicate(leads).map(scoreLead).sort((a,b)=>b.score_min-a.score_min || (a.name||'').localeCompare(b.name||''));
  saveCheckpoint(final,opts.output);
  const files=exportResults(final,String(opts.output),String(opts.mode));
  const metadata={started:new Date().toISOString(),mode:opts.mode,records:final.length,discovery_count:researchCount,
    browsed:final.filter(x=>x.scrape_status==='OK').length, blocked:final.filter(x=>x.scrape_status==='blocked_by_robots').length,
    groq_analyzed:final.filter(x=>x.ai_validation==='EVIDENCE_CHECKED').length,errors:final.filter(x=>x.error).length,
    options:opts};
  fs.writeFileSync(path.join(opts.output,'run_summary.json'),JSON.stringify(metadata,null,2));
  const report=writeReport(final,{folder:opts.output,metadata});
  console.log(`\nTERMINE: ${final.length} candidats (${metadata.browsed} sites visites avec succes)`);
  console.log('CSV:',files.csvFile,'\nJSON:',files.jsonFile,'\nRapport:',report,'\nResume:',path.join(opts.output,'run_summary.json'));
  console.log('ATTENTION: candidats et scores a verifier avant envoi; aucun nombre invente.');
  return {items:final,files,metadata};
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  run().catch(e=>{console.error('\nERREUR:',e.stack||e.message);process.exitCode=1;});
}
