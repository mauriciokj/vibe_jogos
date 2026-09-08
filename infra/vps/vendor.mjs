import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const libraries=[{name:'phaser',version:'3.90.0',files:['dist/phaser.min.js','LICENSE.md'],url:'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js',file:'dist/phaser.min.js'},{name:'three',version:'0.160.0',files:['build/three.module.js','LICENSE'],url:'https://unpkg.com/three@0.160.0/build/three.module.js',file:'build/three.module.js'}];
await fs.mkdir('output/vendor-download',{recursive:true});
for(const lib of libraries){
 const meta=await(await fetch(`https://registry.npmjs.org/${lib.name}/${lib.version}`)).json();const raw=Buffer.from(await(await fetch(meta.dist.tarball)).arrayBuffer());
 if(`sha512-${createHash('sha512').update(raw).digest('base64')}`!==meta.dist.integrity)throw new Error('Package integrity mismatch');
 const archive=`output/vendor-download/${lib.name}.tgz`;await fs.writeFile(archive,raw);const dir=`vendor/${lib.name}-${lib.version}`;await fs.mkdir(dir,{recursive:true});
 for(const file of lib.files){const contents=execFileSync('tar',['-xOf',archive,`package/${file}`],{maxBuffer:10*1024*1024});await fs.writeFile(path.join(dir,file.startsWith('LICENSE')?'LICENSE.txt':path.basename(file)),contents);}
 await fs.writeFile(path.join(dir,'source.json'),JSON.stringify({package:lib.name,version:lib.version,license:meta.license,tarball:meta.dist.tarball,integrity:meta.dist.integrity},null,2));
 const files=execFileSync('git',['ls-files','games'],{encoding:'utf8'}).trim().split('\n').filter(f=>/\.(html|js|mjs)$/.test(f)&&!f.includes('/tests/'));
 for(const file of files){const text=await fs.readFile(file,'utf8');if(text.includes(lib.url))await fs.writeFile(file,text.replaceAll(lib.url,`/${dir}/${path.basename(lib.file)}`));}
 console.log(`Vendored ${lib.name}@${lib.version} with verified npm integrity and license`);
}
