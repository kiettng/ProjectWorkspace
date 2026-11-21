/** Next may normalize Request.url to localhost; Host still identifies the browser-facing authority. */
export function sameRequestOrigin(request:Request) {
 const origin=request.headers.get('origin');if(!origin)return false;
 const target=new URL(request.url);
 const host=request.headers.get('host');if(host)target.host=host;
 return origin===target.origin;
}
