import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  'audio',
  'figure',
  'figcaption',
  'iframe',
  'img',
  'mark',
  'source',
  'span',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'video',
]

const COLOR_VALUE = /^#[0-9a-f]{3,8}$|^rgb(a)?\([\d\s.,%]+\)$|^[a-z]+$/i
const LENGTH_VALUE = /^\d{1,4}(px|em|rem|%)?$/
const ALIGN_VALUE = /^(left|right|center|justify)$/

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html || '', {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      '*': ['class', 'data-*'],
      a: ['href', 'name', 'target', 'title', 'rel'],
      audio: ['controls', 'preload', 'src'],
      blockquote: ['cite'],
      code: ['class'],
      iframe: ['allow', 'allowfullscreen', 'frameborder', 'height', 'loading', 'src', 'title', 'width'],
      img: ['alt', 'decoding', 'height', 'loading', 'src', 'title', 'width'],
      source: ['src', 'type'],
      span: ['style'],
      mark: ['style'],
      p: ['style'],
      div: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
      h5: ['style'],
      h6: ['style'],
      td: ['colspan', 'rowspan', 'style'],
      th: ['colspan', 'rowspan', 'style'],
      video: ['controls', 'height', 'playsinline', 'poster', 'preload', 'src', 'width'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    allowedIframeHostnames: [
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'player.vimeo.com',
    ],
    allowedStyles: {
      '*': {
        color: [COLOR_VALUE],
        'background-color': [COLOR_VALUE],
        'text-align': [ALIGN_VALUE],
        width: [LENGTH_VALUE],
        height: [LENGTH_VALUE],
      },
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: attribs.target === '_blank' ? 'noopener noreferrer' : attribs.rel,
        },
      }),
    },
  })
}
