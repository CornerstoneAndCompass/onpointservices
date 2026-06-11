import { json } from "./_utils.js";

/* Section type definitions that drive the admin page editor.
   Field types: text | textarea | richtext | number | select | image | checkbox | repeater
   (repeater fields have a nested `fields` array). */

const btnStyle = {
  name: "style",
  label: "Button style",
  type: "select",
  options: [
    { value: "primary", label: "Primary (gold)" },
    { value: "ghost", label: "Ghost (outline)" },
  ],
};

const TYPES = {
  hero: {
    label: "Hero",
    description: "Large top banner: headline, intro, buttons and a feature image.",
    fields: [
      { name: "eyebrow", label: "Eyebrow (small label above heading)", type: "text" },
      { name: "heading_outline", label: "Outlined word (large outline text)", type: "text" },
      {
        name: "heading_lines",
        label: "Heading line",
        type: "repeater",
        fields: [
          { name: "text", label: "Text", type: "text" },
          { name: "gold", label: "Gold colour", type: "checkbox" },
        ],
      },
      { name: "lede", label: "Intro paragraph", type: "textarea" },
      {
        name: "buttons",
        label: "Button",
        type: "repeater",
        fields: [
          { name: "label", label: "Label", type: "text" },
          { name: "url", label: "Link URL", type: "text" },
          btnStyle,
        ],
      },
      {
        name: "meta",
        label: "Meta item",
        type: "repeater",
        fields: [
          { name: "label", label: "Label", type: "text" },
          { name: "value", label: "Value", type: "text" },
        ],
      },
      { name: "image", label: "Feature image", type: "image" },
      { name: "image_alt", label: "Image alt text", type: "text" },
      { name: "caption_eyebrow", label: "Image caption eyebrow", type: "text" },
      { name: "caption_title", label: "Image caption title", type: "text" },
    ],
  },

  page_header: {
    label: "Page header",
    description: "Breadcrumb + heading block used at the top of inner pages.",
    fields: [
      {
        name: "crumbs",
        label: "Breadcrumb",
        type: "repeater",
        fields: [
          { name: "label", label: "Label", type: "text" },
          { name: "url", label: "Link URL (blank = current page)", type: "text" },
        ],
      },
      { name: "heading", label: "Heading", type: "text" },
      { name: "heading_gold", label: "Heading (gold part)", type: "text" },
      { name: "lede", label: "Intro paragraph", type: "textarea" },
    ],
  },

  text_media: {
    label: "Text + image",
    description: "A paragraph block beside an image.",
    fields: [
      { name: "eyebrow", label: "Eyebrow", type: "text" },
      { name: "heading", label: "Heading", type: "text" },
      { name: "body", label: "Body", type: "richtext" },
      {
        name: "bullets",
        label: "Bullet",
        type: "repeater",
        fields: [{ name: "text", label: "Text", type: "text" }],
      },
      { name: "image", label: "Image", type: "image" },
      { name: "image_alt", label: "Image alt text", type: "text" },
      {
        name: "image_side",
        label: "Image side",
        type: "select",
        options: [
          { value: "right", label: "Right" },
          { value: "left", label: "Left" },
        ],
      },
      { name: "shaded", label: "Shaded background", type: "checkbox" },
    ],
  },

  feature_grid: {
    label: "Feature grid",
    description: "A grid of feature/service cards.",
    fields: [
      { name: "heading", label: "Heading", type: "text" },
      { name: "heading_gold", label: "Heading (gold part)", type: "text" },
      { name: "lede", label: "Intro paragraph", type: "textarea" },
      {
        name: "columns",
        label: "Columns",
        type: "select",
        options: [
          { value: "2", label: "2" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
        ],
      },
      {
        name: "cards",
        label: "Card",
        type: "repeater",
        fields: [
          { name: "number", label: "Number / label", type: "text" },
          { name: "icon", label: "Icon (name or 'none')", type: "text", default: "none" },
          { name: "title", label: "Title", type: "text" },
          { name: "body", label: "Body", type: "textarea" },
          { name: "image", label: "Image (optional)", type: "image" },
          { name: "link_url", label: "Link URL (optional)", type: "text" },
          { name: "link_label", label: "Link label (optional)", type: "text" },
        ],
      },
    ],
  },

  gallery: {
    label: "Project gallery",
    description: "Filterable grid of project cards with images.",
    fields: [
      { name: "heading", label: "Heading", type: "text" },
      { name: "heading_gold", label: "Heading (gold part)", type: "text" },
      { name: "lede", label: "Intro paragraph", type: "textarea" },
      { name: "show_filter", label: "Show filter buttons", type: "checkbox" },
      {
        name: "items",
        label: "Project",
        type: "repeater",
        fields: [
          { name: "tag", label: "Tag (e.g. Residential · Build)", type: "text" },
          { name: "title", label: "Title", type: "text" },
          { name: "location", label: "Location / date", type: "text" },
          { name: "image", label: "Image", type: "image" },
          { name: "filters", label: "Filter keywords (space separated)", type: "text" },
          { name: "wide", label: "Wide card", type: "checkbox" },
          { name: "link", label: "Link URL", type: "text" },
        ],
      },
    ],
  },

  cta: {
    label: "Call to action",
    description: "Bold closing band with heading and buttons.",
    fields: [
      {
        name: "heading_lines",
        label: "Heading line",
        type: "repeater",
        fields: [
          { name: "text", label: "Text", type: "text" },
          { name: "outline", label: "Outline style", type: "checkbox" },
        ],
      },
      { name: "body", label: "Body", type: "textarea" },
      {
        name: "buttons",
        label: "Button",
        type: "repeater",
        fields: [
          { name: "label", label: "Label", type: "text" },
          { name: "url", label: "Link URL", type: "text" },
          btnStyle,
        ],
      },
    ],
  },

  faq: {
    label: "FAQ",
    description: "Question + answer list.",
    fields: [
      { name: "heading", label: "Heading", type: "text" },
      { name: "heading_gold", label: "Heading (gold part)", type: "text" },
      { name: "lede", label: "Intro paragraph", type: "textarea" },
      {
        name: "items",
        label: "Question",
        type: "repeater",
        fields: [
          { name: "question", label: "Question", type: "text" },
          { name: "answer", label: "Answer", type: "textarea" },
        ],
      },
    ],
  },

  process: {
    label: "Process steps",
    description: "Numbered step-by-step block.",
    fields: [
      { name: "heading", label: "Heading", type: "text" },
      { name: "heading_gold", label: "Heading (gold part)", type: "text" },
      { name: "lede", label: "Intro paragraph", type: "textarea" },
      {
        name: "steps",
        label: "Step",
        type: "repeater",
        fields: [
          { name: "number", label: "Number", type: "text" },
          { name: "title", label: "Title", type: "text" },
          { name: "body", label: "Body", type: "textarea" },
        ],
      },
    ],
  },

  testimonial: {
    label: "Testimonial",
    description: "A single customer quote.",
    fields: [
      { name: "quote", label: "Quote", type: "textarea" },
      { name: "initials", label: "Initials (avatar)", type: "text" },
      { name: "author", label: "Author name", type: "text" },
      { name: "role", label: "Role / location", type: "text" },
    ],
  },

  stats: {
    label: "Stats strip",
    description: "Row of headline numbers.",
    fields: [
      {
        name: "items",
        label: "Stat",
        type: "repeater",
        fields: [
          { name: "number", label: "Number", type: "text" },
          { name: "suffix", label: "Suffix (e.g. +, %)", type: "text" },
          { name: "label", label: "Label", type: "text" },
        ],
      },
    ],
  },

  split_cards: {
    label: "Split cards",
    description: "Two large side-by-side audience cards.",
    fields: [
      {
        name: "cards",
        label: "Card",
        type: "repeater",
        fields: [
          { name: "number_label", label: "Number label", type: "text" },
          { name: "title", label: "Title", type: "text" },
          { name: "body", label: "Body", type: "textarea" },
          { name: "link_label", label: "Link label", type: "text" },
          { name: "link_url", label: "Link URL", type: "text" },
        ],
      },
    ],
  },

  badge_strip: {
    label: "Badge strip",
    description: "Slim band with a label and a link.",
    fields: [
      { name: "eyebrow", label: "Eyebrow", type: "text" },
      { name: "title", label: "Title", type: "text" },
      { name: "link_label", label: "Link label", type: "text" },
      { name: "link_url", label: "Link URL", type: "text" },
    ],
  },

  marquee: {
    label: "Marquee",
    description: "Scrolling word strip.",
    fields: [
      {
        name: "items",
        label: "Word",
        type: "repeater",
        fields: [{ name: "text", label: "Text", type: "text" }],
      },
    ],
  },

  contact_block: {
    label: "Contact block",
    description: "Contact details beside the enquiry form.",
    fields: [
      { name: "heading", label: "Heading", type: "text" },
      { name: "form_heading", label: "Form heading", type: "text" },
    ],
  },
};

export async function onRequestGet() {
  return json({ types: TYPES });
}
