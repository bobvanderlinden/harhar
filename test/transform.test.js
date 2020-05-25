const { transformPostData } = require("../src/transform");

describe("transformPostData", () => {
  it("replaces boundary values with a new one in content-type and postData", () => {
    const postData = {
      mimeType: "multipart/form-data; boundary=originalboundary",
      text: `--originalboundary
Content-Type: text/plain

first part

--originalboundary
Content-Type: text/plain

second part

--originalboundary--`,
    };

    const result = transformPostData(postData, {
      replaceMultipartBoundary: "newboundary",
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "mimeType": "multipart/form-data; boundary=newboundary",
        "text": "--newboundary
      Content-Type: text/plain

      first part

      --newboundary
      Content-Type: text/plain

      second part

      --newboundary--",
      }
    `);
  });

  it("replaces boundary values for base64 encoded postData", () => {
    const postData = {
      mimeType: "multipart/form-data; boundary=originalboundary",
      encoding: "base64",
      text: Buffer.from(
        `--originalboundary
Content-Type: text/plain

first part

--originalboundary
Content-Type: text/plain

second part

--originalboundary--`,
        "binary"
      ).toString("base64"),
    };

    const result = transformPostData(postData, "newboundary");

    expect(result.encoding).toBe("base64");
    const text = Buffer.from(result.text, "base64").toString("binary");
    expect(text).toMatchInlineSnapshot(`
      "--undefined
      Content-Type: text/plain

      first part

      --undefined
      Content-Type: text/plain

      second part

      --undefined--"
    `);
  });
});
