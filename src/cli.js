#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadEnv, normalizeUrl, readSites, sleep} from './utils.js';
import {discoverBerlin} from './discovery.js';
import {discoverSearxng} from './searxng.js';
import {deduplicate,scoreLead} from './scoring.js';
import {queryOpenAI} from './openai.js';
import {exportResults} from './export.js';
import {writeReport} from './report.js';
import {RobotsPolicy} from './robots.js';
import {startBrowser,browseCompany,browseDirectory} from './browser-agent.js';

loadEnv();
const args=process.argv.slice(2);
const flag=(name,def)=>{
  const i=args.indexOf('--'+name);
  return i<0?def:(args[i+1]&&!args[i+1].startsWith('--')?args[i+1]:true);
};
const intFlag=(name,def,min=0,max=2000)=>{
  const value=Number.parseInt(flag(name,def),10);
  return Number.isFinite(value)?Math.max(min,Math.min(max,value)):def;
};
const opts={
  mode:flag('mode','research'),limit:intFlag('limit',20,1),
  maxPages:intFlag('max-pages',3,1,10),searchPages:intFlag('search-pages',2,1,10),
  searchLimit:intFlag('search-limit',140,1,1000),
  input:flag('input','fixtures/sites_berlin.csv'),
  deep:!args.includes('--no-deep'), directories:args.includes('--directories'),
  ai:!args.includes('--no-ai'),
  stagehandAI:args.includes('--stagehand-ai')&&!args.includes('--no-stagehand-ai'),
  maxAiCalls:intFlag('max-ai-calls',20,0,1000),
  output:flag('output','output'), delay:intFlag('delay',2500,300,20000),
  resume:args.includes('--resume'), skipOsm:args.includes('--skip-osm')
};
const logger={warn:s=>console.warn('⚠ '+s),log:console.log};
const mergeCandidate=x=>({...x,website:normalizeUrl(x.website||''),source_pages:x.source_pages||[],
  management_type:x.management_type??null,units_managed:x.units_managed??null,
  berlin_presence:x.berlin_presence??null,validation_status:x.validation_status||'TO_VERIFY'});
const leadKey=x=>{
  try{return new URL(x.website).hostname.toLowerCase().replace(/^www\./,'');}
  catch{return `NAME:${String(x.name||'').toLowerCase()}`;}
};
function saveCheckpoint(items){
  fs.mkdirSync(opts.output,{recursive:true});
  const dest=path.join(opts.output,'checkpoint_latest.json');
  const temp=dest+'.tmp';
  fs.writeFileSync(temp,JSON.stringify({saved_at:new Date().toISOString(),count:items.length,items},null,2));
  fs.renameSync(temp,dest);
}
function recover(items){
  if(!opts.resume)return items;
  const file=path.join(opts.output,'checkpoint_latest.json');
  if(!fs.existsSync(file))return items;
  const old=JSON.parse(fs.readFileSync(file,'utf8')).items||[];
  const indexed=new Map(old.filter(x=>x.scrape_status).map(x=>[leadKey(x),x]));
  let recovered=0;
  const result=items.map(x=>{
    const previous=indexed.get(leadKey(x));
    if(previous){recovered++;return {...x,...previous};}
    return x;
  });
  console.log(`Reprise : ${recovered} visites conservees depuis le checkpoint`);
  return result;
}

export async function run(){
  console.log('\nHEIDI SYSTEMS | STAGEHAND + OPENAI | BERLIN');
  console.log(`Mode: ${opts.mode} | Sites max: ${opts.limit} | OpenAI: ${opts.ai?'OUI':'NON'} | Extraction Stagehand en plus: ${opts.stagehandAI?'OUI':'NON'}`);
  if(opts.ai&&!process.env.OPENAI_API_KEY)throw Error('OPENAI_API_KEY manquante dans .env. Sinon utilise --no-ai.');
  if(opts.stagehandAI&&!process.env.OPENAI_API_KEY)throw Error('Stagehand AI exige OPENAI_API_KEY.');
  let leads=[];
  if(opts.mode==='sites'){
    leads=readSites(String(opts.input)).map(mergeCandidate);
  } else if(opts.mode==='research'){
    if(!opts.skipOsm){
      try{
        const osm=await discoverBerlin({limit:opts.searchLimit});
        leads.push(...osm.map(mergeCandidate));
        console.log(`OpenStreetMap : ${osm.length} candidats`);
      }catch(e){logger.warn(`Overpass indisponible : ${e.message}`);}
    }else console.log('OpenStreetMap : ignore (--skip-osm)');
    if(process.env.SEARXNG_URL){
      try{
        const candidates=await discoverSearxng({baseUrl:process.env.SEARXNG_URL,limit:opts.searchLimit,pages:opts.searchPages,logger});
        leads.push(...candidates.map(mergeCandidate));
        console.log(`SearXNG : ${candidates.length} candidats`);
      }catch(e){logger.warn(`SearXNG : ${e.message}`);}
    }
  }else throw Error('Mode attendu : research ou sites');
  leads=deduplicate(leads);
  if(!leads.length)throw Error('Aucun candidat. Verifie SearXNG, sinon lance --mode sites.');
  const discoveryCount=leads.length;
  console.log(`Candidats uniques : ${leads.length}`);
  if(opts.deep){
    const robots=new RobotsPolicy({agent:'BerlinPropertyResearch',delayMs:opts.delay,logger});
    let browser;
    try{
      browser=await startBrowser();
      console.log('Stagehand Chromium : DEMARRE');
      if(opts.directories){
        const file='fixtures/directories.txt';
        if(fs.existsSync(file)){
          for(const url of fs.readFileSync(file,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'))){
            try{
              const found=await browseDirectory(browser,url,{robots,maxPages:opts.searchPages,delayMs:opts.delay,logger,stagehandAI:opts.stagehandAI});
              leads.push(...found.map(mergeCandidate));
              console.log(`Annuaire ${url}: ${found.length} candidats`);
            }catch(e){logger.warn(`Annuaire ignore ${url}: ${e.message}`);}
          }
          leads=deduplicate(leads);
        }
      }
      leads=recover(leads);
      // Tour de role entre sources, pour une collecte plus variee.
      const groups={searx:[],osm:[],directory:[],other:[]};
      leads.forEach((x,i)=>{
        if(!x.website)return;
        const source=String(x.discovery_source||'');
        if(source.includes('SearX'))groups.searx.push(i);
        else if(source.includes('directory'))groups.directory.push(i);
        else if(String(x.source_url||'').includes('openstreetmap.org'))groups.osm.push(i);
        else groups.other.push(i);
      });
      const selected=[];
      for(let n=0;selected.length<opts.limit;n++){
        let found=false;
        for(const group of Object.values(groups)){
          if(group[n]!==undefined){selected.push(group[n]);found=true;}
          if(selected.length>=opts.limit)break;
        }
        if(!found)break;
      }
      console.log(`Sites selectionnes : ${selected.length} / ${leads.length}`);
      let analyzed=0;
      for(let pos=0;pos<selected.length;pos++){
        const i=selected[pos],x=leads[i];
        if(opts.resume && x.scrape_status){console.log(`[${pos+1}/${selected.length}] deja traite : ${x.website}`);continue;}
        console.log(`[${pos+1}/${selected.length}] ${x.name}: ${x.website}`);
        try{
          let row=await browseCompany(browser,x,{robots,maxPages:opts.maxPages,stagehandAI:opts.stagehandAI,delayMs:opts.delay,logger});
          if(opts.ai && row.scrape_status==='OK' && analyzed<opts.maxAiCalls){
            row=await queryOpenAI(row);
            analyzed++;
            await sleep(1200);
          }else if(opts.ai && analyzed>=opts.maxAiCalls){row.ai_validation='SKIPPED_AI_BUDGET';}
          leads[i]=row;
          console.log(` -> ${row.scrape_status} | pages=${row.documents_visited||0} | IA=${row.ai_validation||'NON'}`);
        }catch(e){leads[i]={...x,scrape_status:'FAILED',error:e.message};logger.warn(e.message);}
        saveCheckpoint(leads);
      }
    }finally{
      if(browser)try{await browser.close();}catch(e){logger.warn('Fermeture navigateur: '+e.message);}
    }
  }
  const final=deduplicate(leads).map(scoreLead).sort((a,b)=>b.score_min-a.score_min||(a.name||'').localeCompare(b.name||''));
  saveCheckpoint(final);
  const files=exportResults(final,String(opts.output),String(opts.mode));
  const metadata={completed_at:new Date().toISOString(),mode:opts.mode,records:final.length,
    discovery_count:discoveryCount,browsed:final.filter(x=>x.scrape_status==='OK').length,
    openai_analyzed:final.filter(x=>x.ai_validation==='EVIDENCE_CHECKED').length,
    errors:final.filter(x=>x.error||x.ai_error).length,options:opts};
  fs.writeFileSync(path.join(opts.output,'run_summary.json'),JSON.stringify(metadata,null,2));
  writeReport(final,{folder:opts.output,metadata});
  console.log(`\nTERMINE : ${final.length} candidats / ${metadata.browsed} sites parcourus`);
  console.log('CSV :',files.csvFile,'\nJSON :',files.jsonFile);
  console.log('Vérifie les noms, coordonnées et preuves avant la soumission.');
  return {items:final,files,metadata};
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  run().catch(e=>{console.error('\nERREUR:',e.stack||e.message);process.exitCode=1;});
