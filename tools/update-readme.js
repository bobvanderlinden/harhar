const { program } = require("../src/cli");
const { readFileSync } = require("fs");
const path = require("path");
const package = require("../package.json");

const executableName = Object.keys(package.bin)[0];

const readmeContent = readFileSync(
  path.join(__dirname, "../README.md")
).toString();

const [before, after] = readmeContent.split(
  /(?:^|\n)## Commands\n.*(?:\n## |$)/ms
);

const section = (title, contents) => ({ type: "section", title, contents });
const list = (items) => ({ type: "list", items });
const paragraph = (content) => ({ type: "paragraph", content });
const code = (content, syntax = undefined) => ({
  type: "code",
  content,
  syntax,
});

function getMarkdownFromInlineDocument(document, context = { level: 0 }) {
  if (typeof document === "string") {
    return document;
  }
  if (Array.isArray(document)) {
    return document
      .map((document) => getMarkdownFromInlineDocument(document, context))
      .join("");
  }
  switch (document.type) {
    case "code":
      return `\`${document.content}\``;
    default:
      console.log(document);
      throw new Error(`Not supported: ${document.type}`);
  }
}

function getMarkdownFromDocument(document, context = { level: 0 }) {
  if (typeof document === "string") {
    return document;
  }
  if (Array.isArray(document)) {
    return document.map(getMarkdownFromDocument).join("");
  }
  switch (document.type) {
    case "section":
      return `${"#".repeat(context.level + 1)} ${
        document.title
      }\n\n${document.contents
        .map((content) =>
          getMarkdownFromDocument(content, { level: context.level + 1 })
        )
        .join("\n\n")}`;
    case "paragraph":
      return getMarkdownFromInlineDocument(document.content, context);
    case "list":
      return document.items
        .map((item) => getMarkdownFromInlineDocument(item, context))
        .map((line) => `* ${line}`)
        .join("\n");
    case "code":
      return `\`\`\`${document.syntax || ""}\n${document.content}\n\`\`\``;
    default:
      console.log(document);
      throw new Error(`Not supported: ${document.type}`);
  }
}

function documentCommand(command) {
  return section(command.name(), [
    paragraph([
      "Usage: ",
      code(`${executableName} ${command.name()} ${command.usage()}`),
    ]),
    paragraph(command._description),
    list(
      command.options.map((option) => [
        code(option.flags),
        ": ",
        option.description,
      ])
    ),
  ]);
}

const newReadmeContent = [
  before,
  getMarkdownFromDocument(
    section("Commands", program.commands.map(documentCommand)),
    { level: 1 }
  ),
  after,
].join("");

process.stdout.write(newReadmeContent);
