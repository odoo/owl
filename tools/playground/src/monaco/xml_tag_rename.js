function findTagPairAtOffset(text, offset) {
  const tagRe = /<\/?([A-Za-z_][A-Za-z0-9._:-]*)([^>]*?)(\/?)>/g;
  const stack = [];
  let match;

  while ((match = tagRe.exec(text))) {
    const name = match[1];
    const isClosing = match[0].startsWith("</");
    const isSelfClosing = !isClosing && match[3] === "/";

    if(isSelfClosing) continue;

    const start = match.index + match[0].indexOf(name);
    const end = start + name.length;
    const tag = { name, start, end, isClosing };

    if (!isClosing) {
      stack.push(tag);
      continue;
    }
    const open = stack.pop();
    if (!open || open.name !== name) continue;

    if (offset >= open.start && offset <= open.end) return [open, tag];
    if (offset >= tag.start && offset <= tag.end) return [tag, open];
  }

  return null;
}

export function registerXmlTagRename(monaco) {
  return monaco.languages.registerLinkedEditingRangeProvider("xml", {
    provideLinkedEditingRanges(model, position) {
      const pair = findTagPairAtOffset(model.getValue(), model.getOffsetAt(position));
      if (!pair) return null;

      return {
        ranges: pair.map(({ start, end }) => {
          const s = model.getPositionAt(start);
          const e = model.getPositionAt(end);
          return new monaco.Range(s.lineNumber, s.column, e.lineNumber, e.column);
        }),
      };
    },
  });
}
