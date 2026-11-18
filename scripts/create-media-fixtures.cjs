// Synthetic non-personal fixtures for the real upload/analysis acceptance tests.
const fs=require('node:fs'),path=require('node:path'),zip=require('fflate');
const dir=path.resolve('.database-audit/fixtures');fs.mkdirSync(dir,{recursive:true});
const files={
  '[Content_Types].xml':zip.strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
  '_rels/.rels':zip.strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
  'word/document.xml':zip.strToU8('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Synthetic TARS document test. Project Nebula has final review on Monday. Reference code: NEBULA-814.</w:t></w:r></w:p></w:body></w:document>'),
};
const file=path.join(dir,'notes-test.docx');fs.writeFileSync(file,zip.zipSync(files));console.log(JSON.stringify({file,bytes:fs.statSync(file).size,synthetic:true}));
