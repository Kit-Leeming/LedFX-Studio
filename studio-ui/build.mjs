import {cp,mkdir,readdir,rm} from 'node:fs/promises';
const source=new URL('./dist/',import.meta.url);
const names=new Set(await readdir(new URL('assets/',source)));
for(const relative of ['frontend/public/studio','ledfx_frontend/studio']){
 const target=new URL(`../${relative}/`,import.meta.url),assets=new URL('assets/',target);
 await mkdir(assets,{recursive:true});
 await cp(source,target,{recursive:true});
 for(const name of await readdir(assets)){
  if(!names.has(name)&&/^(index|vendor|stage-canvas|patch-graph)-[\w-]+\.(js|css)$/.test(name)) await rm(new URL(name,assets));
 }
 console.log(`Updated existing Studio assets: ${relative}`);
}
