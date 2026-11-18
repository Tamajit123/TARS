/** Remove non-rendering editor metadata that react-native-svg otherwise
 * forwards as invalid React DOM props. Visible paths, colors and viewBox stay. */
export function providerSvg(xml:string){
  return xml.replace(/\s+(?:(?:inkscape|sodipodi):[\w-]+|xmlns:(?:svg|inkscape|sodipodi))\s*=\s*(?:"[^"]*"|'[^']*')/g,'')
    .replace(/<sodipodi:namedview\b[^>]*\/>/g,'');
}
