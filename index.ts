import { readFileSync, writeFileSync } from 'node:fs';
import * as HTMLParser from 'node-html-parser';
import * as css from 'css';

declare type HElem = HTMLParser.HTMLElement & { $$index?: number };

const classFilter = (x: string) => x.startsWith('x-');

const htmlFile = readFileSync('./in/demo.html', { encoding: 'utf-8' });
const cssFile = readFileSync('./in/demo.css', { encoding: 'utf-8' });

const htmlTree = HTMLParser.parse(htmlFile) as HElem;
const cssTree = css.parse(cssFile);

const relevantNodes = getRelevantNodes(htmlTree, x => x.tagName && x.classList && x.classList.value.some(classFilter) ? true : false);

relevantNodes.forEach((x, i) => x.$$index = i);

const cssDeclarationToSelectorMap = new Map<string, Set<string>>();

const cssRules = (cssTree.stylesheet?.rules ?? []) as css.Rule[];
for (const cssRule of cssRules) {
  for (const cssDeclaration of ((cssRule.declarations ?? []) as css.Declaration[])) {
    const cssDeclarationKey = `${cssDeclaration.property}: ${cssDeclaration.value}`;
    let cssSelectorSet = cssDeclarationToSelectorMap.get(cssDeclarationKey);
    if (cssSelectorSet == undefined) {
      cssDeclarationToSelectorMap.set(cssDeclarationKey, cssSelectorSet = new Set<string>())
    }
    cssRule.selectors?.forEach(s => cssSelectorSet?.add(s))
  }
}

const cssDeclarationWithHtmlNodes: [string, HElem[]][] = [];

for (const [cssDeclaration, cssSelectorSet] of cssDeclarationToSelectorMap.entries()) {
  const htmlNodes = [...cssSelectorSet].map(s => relevantNodes.filter(n => n.classList?.value?.some(c => `.${c}` === s))).flat();
  cssDeclarationWithHtmlNodes.push([cssDeclaration, htmlNodes]);
}

const mx = Array.from({ length: cssDeclarationWithHtmlNodes.length }).map(x => Array.from({ length: relevantNodes.length }).fill(0))

for (const [cssIndex, [cssDeclaration, htmlNodes]] of cssDeclarationWithHtmlNodes.entries()) {
  for (const htmlNode of htmlNodes) {
    mx[cssIndex][htmlNode.$$index!] = 1;    
  }
}

console.log(mx.map(x => x.join(' ')).join('\n'))

const coverItems: [number[], number[]][] = [];

while(containsOnes()) coverItems.push(findMaxOnlyOnesArea())

console.log(coverItems)

let newCSSSheet = '';

relevantNodes.forEach(x => x.classList.value.filter(classFilter).forEach(y => x.classList.remove(y)));

for (const [idx, [coverItemCssDeclarationIndexes, coverItemHtmlNodeIndexes]] of coverItems.entries()) {
  const cssRuleKey = `q${idx}`;
  newCSSSheet += `.${cssRuleKey}{${coverItemCssDeclarationIndexes.map(i => cssDeclarationWithHtmlNodes[i][0]).join(';')}}\n`;
  for (const coverItemHtmlNodeIndex of coverItemHtmlNodeIndexes) {
    relevantNodes[coverItemHtmlNodeIndex].classList.add(cssRuleKey)
  }
}

writeFileSync('./out/demo.html', htmlTree.toString());
writeFileSync('./out/demo.css', newCSSSheet);

function containsOnes() {
  for (const mxr of mx)
    for (const mxrc of mxr)
      if (mxrc === 1)
        return true;
  return false;
}

function findMaxOnlyOnesArea(): [number[], number[]] {
  let cssDeclarationIndexes = Array.from({ length: mx.length }).fill(0).map((x, i) => i);
  let htmlNodeIndexes = Array.from({ length: mx[0].length }).fill(0).map((x, i) => i);

  while(containsZeros()) {
    const [maxCssIndex, maxCssCount] = maxCssNotOnesCount();
    const [maxHtmlNodeIndex, maxHtmlNodeCount] = maxHtmlNodeNotOnesCount();
    if ((maxCssCount / htmlNodeIndexes.length) > (maxHtmlNodeCount / cssDeclarationIndexes.length)) {
      cssDeclarationIndexes = cssDeclarationIndexes.filter(x => x !== maxCssIndex);
    } else {
      htmlNodeIndexes = htmlNodeIndexes.filter(x => x !== maxHtmlNodeIndex);
    }

    // console.log(cssIndexes.map(x => htmlNodeIndexes.map(y => mx[x][y]).join(' ')).join('\n'))
  }

  for (const cssIndex of cssDeclarationIndexes)
    for (const htmlNodeIndex of htmlNodeIndexes)
      mx[cssIndex][htmlNodeIndex] = 2;

  return [cssDeclarationIndexes, htmlNodeIndexes];

  function maxCssNotOnesCount() {
    let maxIndex = 0;
    let maxCount = 0;
    for (const cssIndex of cssDeclarationIndexes) {
      let count = 0;
      for (const htmlNodeIndex of htmlNodeIndexes) {
        if (mx[cssIndex][htmlNodeIndex] !== 1) {
          count++;
        }
      }
      if (count > maxCount) {
        maxCount = count;
        maxIndex = cssIndex;
      }
    }
    return [maxIndex, maxCount];
  }

  function maxHtmlNodeNotOnesCount() {
    let maxIndex = 0;
    let maxCount = 0;
    for (const htmlNodeIndex of htmlNodeIndexes) {
      let count = 0;
      for (const cssIndex of cssDeclarationIndexes) {
        if (mx[cssIndex][htmlNodeIndex] !== 1) {
          count++;
        }
      }
      if (count > maxCount) {
        maxCount = count;
        maxIndex = htmlNodeIndex;
      }
    }
    return [maxIndex, maxCount];
  }

  function containsZeros() {
    for (const cssIndex of cssDeclarationIndexes)
      for (const htmlNodeIndex of htmlNodeIndexes)
        if (mx[cssIndex][htmlNodeIndex] === 0)
          return true;
    return false;
  }
}

function getRelevantNodes(node: HElem, relevantSelector: (e: HElem) => boolean): HElem[] {

  const nodes: HElem[] = [];

  if (relevantSelector(node)) {
    nodes.push(node);
  }

  const childNodes = node.childNodes ?? [];

  for (const childNode of childNodes) {
    nodes.push(...getRelevantNodes(childNode as HElem, relevantSelector))
  }

  return nodes;
}