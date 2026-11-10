import { clean, stripAccents } from './utils.js';
export function deduplicate(items) {
  const merged=new Map();
  for(const item of items){
    let domain='';try{if(item.website)domain=new URL(item.website).hostname.replace(/^www\./,'');}catch{}
    const key=domain && !['example.com','example.org'].includes(domain)?`D:${domain}`:`N:${stripAccents(item.name)}:${stripAccents(item.address)}`;
    if(!merged.has(key)){merged.set(key,{...item});continue;}
    const current=merged.get(key);
    for(const field of ['website','email','phone','address','units_managed','management_type']){
      if((current[field]===null||current[field]===undefined||current[field]==='') && item[field]!=null&&item[field]!=='')current[field]=item[field];
    }
    current.source_url=[...new Set([current.source_url,item.source_url].flatMap(x=>String(x||'').split(' | ')).filter(Boolean))].join(' | ');
  }
  return [...merged.values()];
}
export function scoreLead(row) {
  // Ce score est une grille pedagogique. L'inconnu ne signifie pas zero.
  // 35 points: type de gestion; 30 points: volume; 20 points: Berlin; 15 points: contact.
  let min=0,max=0;
  if (row.management_type === 'residential') {min+=35;max+=35;}
  else if(row.management_type==='mixed'){min+=25;max+=25;}
  else if(row.management_type==='commercial'||row.management_type==='sales_only'){min+=0;max+=0;}
  else max+=35;
  if(Number.isSafeInteger(row.units_managed)&&row.units_managed>=0){
    const val=row.units_managed>=1000?30:row.units_managed>=100?18:row.units_managed>0?7:0;
    min+=val;max+=val;
  } else max+=30;
  if(row.berlin_presence===true){min+=20;max+=20;}else if(row.berlin_presence===null||row.berlin_presence===undefined)max+=20;
  if(row.email || row.phone){min+=15;max+=15;}else max+=15;
  return {...row,score_min:min,score_max:max,priority:min>=75?'HIGH':min>=45?'MEDIUM': 'NEEDS_REVIEW'};
}
