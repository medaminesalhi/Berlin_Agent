import fs from 'node:fs';import path from 'node:path';
const cols=['name','website','address','city','phone','email','management_type','units_managed','berlin_presence','score_min','score_max','priority','source_url','source_pages','units_evidence','type_evidence','reason','scrape_status','ai_validation','validation_status'];
function escapeCsv(value){
  let v=Array.isArray(value)?value.join(' | '):value===null||value===undefined?'':String(value);
  // Evite injection de formule lors de l'ouverture dans Excel/Sheets
  if(/^[=+@\-]/.test(v))v="'"+v;
  return '"'+v.replace(/"/g,'""')+'"';
}
export function exportResults(items,folder='output',mode='live'){
  fs.mkdirSync(folder,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const basename=`heidi_${mode}_${stamp}`;
  const csvFile=path.join(folder,basename+'.csv');
  const jsonFile=path.join(folder,basename+'.json');
  fs.writeFileSync(csvFile,'\ufeff'+cols.map(escapeCsv).join(';')+'\r\n'+items.map(x=>cols.map(c=>escapeCsv(x[c])).join(';')).join('\r\n')+'\r\n');
  fs.writeFileSync(jsonFile,JSON.stringify({date:new Date().toISOString(),mode,count:items.length,items},null,2));
  return {csvFile,jsonFile};
}
