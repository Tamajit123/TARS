import {unzipSync,strFromU8} from 'npm:fflate@0.8.3';
const decode=(text:string)=>text.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,value=>{const named:Record<string,string>={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};if(named[value])return named[value];const number=value[2]?.toLowerCase()==='x'?parseInt(value.slice(3,-1),16):parseInt(value.slice(2,-1),10);return number>0&&number<=0x10ffff?String.fromCodePoint(number):'';});
const text=(xml:string)=>decode(xml.replace(/<\/(?:w:p|a:p|row)>/g,'\n').replace(/<(?:w:tab|w:br|a:br)\b[^>]*\/>/g,'\t').replace(/<[^>]*>/g,''));
/** Extract only text/cached values. No macros, formulas, XML entities or external
 * relationships execute. Bound both archive expansion and extracted context. */
export function extractOfficeText(bytes:Uint8Array,extension:string){
  if(bytes[0]!==80||bytes[1]!==75)throw new Error('This is not a valid modern Office document.');
  let entries=0,total=0;
  const files=unzipSync(bytes,{filter:entry=>{
    if(++entries>1000||entry.originalSize>5*1024*1024||(total+=entry.originalSize)>20*1024*1024||entry.originalSize>Math.max(1,entry.size)*150)throw new Error('This document archive exceeds safe extraction limits. Export it as PDF or split it.');
    return extension==='docx'?entry.name==='word/document.xml':extension==='pptx'?/^ppt\/slides\/slide\d+\.xml$/.test(entry.name):/^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(entry.name);
  }});
  const xml=Object.fromEntries(Object.entries(files).map(([name,data])=>{const value=strFromU8(data);if(/<!DOCTYPE|<!ENTITY/i.test(value))throw new Error('Documents containing XML entity declarations are unsupported.');return [name,value];}));
  let output='';
  if(extension==='xlsx'){
    const strings=[...(xml['xl/sharedStrings.xml']||'').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(match=>text(match[1]));
    for(const name of Object.keys(xml).filter(name=>name.includes('/worksheets/')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){
      output+=`\n${name}\n`;
      for(const cell of xml[name].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
        const address=cell[1].match(/\br="([A-Z]+\d+)"/)?.[1]||'cell';
        const raw=cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]||cell[2];
        const value=/\bt="s"/.test(cell[1])?strings[Number(raw)]??'':text(raw);
        output+=`${address}: ${value}\n`;
      }
    }
  }else output=Object.keys(xml).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(name=>text(xml[name])).join('\n');
  if(!output.trim())throw new Error('No readable text was found. Attach a PDF or image of the document.');
  if(output.length>120000)throw new Error('The extracted document exceeds 120,000 characters. Split it; content was not truncated.');
  return 'Office text extraction: text and cached cell values only. Charts, embedded images, formatting and recalculated formulas are not included.\n'+output;
}
