'use client';
import { useEffect,useRef,useState } from 'react';
import { LoaderCircle } from 'lucide-react';

const shell=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; font-src data: blob:; style-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;background:#e9edf2}body{overflow:auto}.docx-wrapper{padding:20px!important;background:transparent!important;min-width:max-content}.docx-wrapper>section.docx{margin:0 auto 20px!important;box-shadow:0 2px 12px #172b4d20!important}a{pointer-events:none;color:inherit}*{box-sizing:border-box}img{max-width:100%}</style></head><body></body></html>`;

/** Render locally in an isolated, script-free document. No third-party document viewer receives the file. */
export default function WordPreview({url,title='Tài liệu Word'}:{url:string;title?:string}) {
 const frame=useRef<HTMLIFrameElement>(null),[ready,setReady]=useState(0),[zoom,setZoom]=useState('fit');
 const [busy,setBusy]=useState(true),[error,setError]=useState('');
 const zoomRef=useRef(zoom);zoomRef.current=zoom;
 const fitRef=useRef<()=>void>(()=>{});
 useEffect(()=>{fitRef.current();},[zoom]);
 useEffect(()=>{
  if(!ready)return;
  const controller=new AbortController();let active=true,observer:ResizeObserver|undefined;
  const frameDocument=frame.current?.contentDocument;if(!frameDocument)return;
  const doc:Document=frameDocument;
  doc.body.replaceChildren();setBusy(true);setError('');
  const content=doc.createElement('div'),styles=doc.createElement('div');doc.body.append(styles,content);
  async function render(){
   try {
    const [response,renderer]=await Promise.all([fetch(url,{signal:controller.signal,credentials:'omit'}),import('docx-preview')]);
    if(!response.ok)throw new Error(response.status===401||response.status===403?'Liên kết xem trước đã hết hạn. Hãy chọn lại tài liệu.':'Không thể tải nội dung Word. Hãy thử mở lại tài liệu.');
    const bytes=await response.arrayBuffer();if(!active)return;
    await renderer.renderAsync(bytes,content,styles,{inWrapper:true,breakPages:true,renderHeaders:true,renderFooters:true,renderFootnotes:true,renderEndnotes:true,
     ignoreLastRenderedPageBreak:false,useBase64URL:true,renderAltChunks:false,renderComments:false,experimental:false});
    if(!active)return;
    content.querySelectorAll('a').forEach(a=>a.removeAttribute('href'));
    const fit=()=>{
     const wrapper=content.querySelector<HTMLElement>('.docx-wrapper');if(!wrapper)return;
     wrapper.style.zoom='1';
     const pages=Array.from(content.querySelectorAll<HTMLElement>('section.docx'));
     const width=Math.max(794,...pages.map(page=>page.getBoundingClientRect().width))+40;
     wrapper.style.width=`${width}px`;wrapper.style.minWidth='0';
     wrapper.style.zoom=String(zoomRef.current==='fit'?Math.min(1,Math.max(.15,((doc.documentElement.clientWidth||width)-4)/width)):Number(zoomRef.current)/100);
    };
    fitRef.current=fit;fit();observer=new ResizeObserver(fit);if(frame.current)observer.observe(frame.current);
    await doc.fonts.ready;if(active){fit();setBusy(false);}
   }catch(e){if(active){setError(e instanceof Error?e.message:'Không thể xem tài liệu Word.');setBusy(false);}}
  }
  void render();
  return()=>{active=false;controller.abort();observer?.disconnect();fitRef.current=()=>{};content.remove();styles.remove();};
 },[url,ready]);
 return <div className="word-viewer"><div className="word-viewer-toolbar"><span>Bố cục trang Word</span><label>Thu phóng <select aria-label="Thu phóng Word" value={zoom} onChange={e=>setZoom(e.target.value)}><option value="fit">Vừa chiều rộng</option>{['50','75','100','125','150'].map(z=><option key={z} value={z}>{z}%</option>)}</select></label></div><div className="word-viewer-stage"><iframe ref={frame} title={title} sandbox="allow-same-origin" referrerPolicy="no-referrer" srcDoc={shell} onLoad={()=>setReady(n=>n+1)}/>{busy?<div className="word-loading" role="status"><LoaderCircle className="spin" size={24}/>Đang dựng bố cục tài liệu…</div>:null}{error?<div className="word-loading error-banner" role="alert">{error}</div>:null}</div><p className="word-viewer-note">Font chữ và ngắt trang có thể khác Word. Tải bản gốc để in chính xác.</p></div>;
}
