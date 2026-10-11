import { Pipe, PipeTransform } from '@angular/core';

// Turns the simple Markdown the AI sometimes writes into HTML for the chat bubble:
//   **bold** / __bold__  -> bold
//   *italic*             -> italic
//   "- item" / "* item"  -> "• item"
//   "# Heading"          -> bold line
// The text is HTML-escaped first, so nothing in the reply can inject markup.
// Line breaks are kept by the bubble's `white-space: pre-wrap`.
@Pipe({
  name: 'chatFormat'
})
export class ChatFormatPipe implements PipeTransform {

  transform(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    return escaped
      .replace(/^[ \t]*[-*][ \t]+/gm, '• ')                          // list items (before italics, which also use *)
      .replace(/^#{1,6}[ \t]+(.+)$/gm, '<strong>$1</strong>')         // headings
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?![*\w])/g, '$1<em>$2</em>');
  }

}
