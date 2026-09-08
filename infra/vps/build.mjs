import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const destination=path.join(repo,'output/vps-release');
await fs.rm(destination,{recursive:true,force:true});
await fs.mkdir(path.join(destination,'public'),{recursive:true});
await fs.mkdir(path.join(destination,'services'),{recursive:true});
const extension=/\.(html|css|js|mjs|json|wasm|svg|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|otf|mp3|ogg|wav|mp4|glb|gltf|bin|txt)$/i;
async function copyPublic(from,to){
 for(const entry of await fs.readdir(from,{withFileTypes:true})){
  if(entry.name.startsWith('.')||['tests','output','node_modules','packages','marketing','server.mjs','package.json','package-lock.json'].includes(entry.name))continue;
  const source=path.join(from,entry.name),target=path.join(to,entry.name);
  if(entry.isDirectory()){await fs.mkdir(target,{recursive:true});await copyPublic(source,target);}
  else if(entry.isFile()&&extension.test(entry.name))await fs.copyFile(source,target);
 }
}
for(const folder of ['games','vendor']){await fs.mkdir(path.join(destination,'public',folder),{recursive:true});await copyPublic(path.join(repo,folder),path.join(destination,'public',folder));}
for(const file of ['index.html','style.css','favicon.ico'])await fs.copyFile(path.join(repo,file),path.join(destination,'public',file));
await fs.mkdir(path.join(destination,'public/catalogo'),{recursive:true});
for(const file of ['index.html','style.css'])await fs.copyFile(path.join(repo,file),path.join(destination,'public/catalogo',file));
// Short URLs remain on /<game>/ while legacy /games/<game>/ URLs keep working.
const publicRoot=path.join(destination,'public');
for(const game of await fs.readdir(path.join(publicRoot,'games'))){
  await fs.symlink(`games/${game}`,path.join(publicRoot,game));
}
for(const file of ['index.html','catalogo/index.html']){
  const filename=path.join(publicRoot,file);
  const html=await fs.readFile(filename,'utf8');
  await fs.writeFile(filename,html.replaceAll('href="/games/','href="/'));
}
await build({entryPoints:[path.join(repo,'sources/asfalto-bruto/server/dev.ts')],outfile:path.join(destination,'services/asfalto.cjs'),bundle:true,platform:'node',target:'node22',format:'cjs',external:['bufferutil','utf-8-validate']});
await build({entryPoints:[path.join(repo,'infra/vps/catalog-server.cjs')],outfile:path.join(destination,'services/catalog.cjs'),bundle:true,platform:'node',target:'node22',format:'cjs',external:['@vercel/kv']});
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const dirty=!!execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'}).trim();
const manifest={commit,dirty,builtAt:new Date().toISOString(),games:(await fs.readdir(path.join(destination,'public/games'))).sort()};
await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({directory:destination,...manifest},null,2));
