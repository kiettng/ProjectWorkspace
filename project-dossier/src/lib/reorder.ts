export function moveId(ids:string[],source:string,target:string):string[] {
 if(source===target)return ids;
 const from=ids.indexOf(source),to=ids.indexOf(target);
 if(from<0||to<0)return ids;
 const next=[...ids];
 next.splice(from,1);
 next.splice(to,0,source);
 return next;
}
