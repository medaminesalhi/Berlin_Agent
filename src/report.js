import fs from 'node:fs';
import path from 'node:path';
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function writeReport(records, {folder='output', metadata={}}={}){
 const stats={total:records.length,websites:records.filter(r=>r.website).length,
  visited:records.filter(r=>r.scrape_status==='OK').length,
  emails:records.filter(r=>r.email).length,
  units:records.filter(r=>Number.isInteger(r.units_managed)).length,
  robots:records.filter(r=>r.scrape_status==='blocked_by_robots').length};
 const rows=records.slice(0,25).map(r=>`<tr><td>${safe(r.name)}</td><td>${safe(r.website)}</td><td>${safe(r.score_min)}–${safe(r.score_max)}</td><td>${safe(r.scrape_status||'NOT_BROWSED')}</td></tr>`).join('');
 const html=`<!DOCTYPE html><html lang="fr"><meta charset="utf-8"><title>Heidi Systems - Rapport de methode</title><style>body{font:15px/1.55 Arial;margin:3rem auto;max-width:960px;padding:0 1rem;color:#20283c}h1{color:#18396b}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd3df;padding:7px;text-align:left}th{background:#eaf2fa}.alert{background:#fff4d6;padding:12px;border-left:4px solid #b28a24}</style>
<h1>Heidi Systems — Recherche B2B à Berlin</h1><p>Date de la collecte : ${safe(new Date().toISOString())}</p>
<h2>Résumé de cette exécution</h2><ul><li>Candidats : ${stats.total}</li><li>Sites web identifiés : ${stats.websites}</li><li>Sites parcourus : ${stats.visited}</li><li>Emails professionnels publics : ${stats.emails}</li><li>Nombres de logements avec preuve : ${stats.units}</li><li>Sites bloqués par robots.txt : ${stats.robots}</li></ul>
<h2>Méthodologie</h2><ol><li>Découverte via Overpass/OpenStreetMap et éventuellement SearXNG (plusieurs recherches en allemand).</li><li>Analyse optionnelle d'annuaires publics et pagination sur les sites autorisés.</li><li>Navigation dans un véritable navigateur Stagehand/Chromium : accueil, contact, à propos, services.</li><li>Extraction sémantique facultative via Stagehand et OpenAI (gpt-4.1-mini).</li><li>Validation prudente des chiffres : seule une valeur avec citation exacte issue du site est retenue.</li><li>Déduplication et score : activité (35), volume connu (30), Berlin (20), contact (15). Une valeur inconnue produit un intervalle de score.</li></ol>
<h2>Sources et limites</h2><p>Chaque ligne du JSON/CSV contient la source de découverte et, après scraping, les URLs consultées. Les listes de moteurs sont des candidats et ne prouvent pas à elles seules l'activité commerciale. Les sites inaccessibles et les données absentes sont identifiés comme tels. Les scores servent à prioriser une vérification humaine, ils ne constituent pas une vérité commerciale. © OpenStreetMap contributors.</p>
<div class="alert"><strong>Avant soumission :</strong> vérifiez les noms, sites, activités, contacts et KPIs. Supprimez les sociétés non pertinentes. Les données peuvent être incomplètes et les contacts professionnels doivent rester conformes aux règles applicables.</div>
<h2>Premiers candidats (non validés)</h2><table><tr><th>Entreprise</th><th>Site</th><th>Score</th><th>Statut</th></tr>${rows}</table></html>`;
 fs.mkdirSync(folder,{recursive:true});const filename=path.join(folder,'methodologie_auto.html');fs.writeFileSync(filename,html);return filename;
}
