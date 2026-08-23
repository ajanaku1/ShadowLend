const fs = require("fs");
const path = require("path");
const { expect } = require("chai");

describe("Landing footer ownership proof", function () {
  it("shows the authorized X account with a safe external link", function () {
    const landingSource = fs.readFileSync(
      path.resolve(__dirname, "../frontend/src/Landing.jsx"),
      "utf8"
    );
    const footerMatch = landingSource.match(
      /<footer className="landing-footer">([\s\S]*?)<\/footer>/
    );

    expect(footerMatch, "landing footer should exist").to.not.equal(null);
    expect(footerMatch[1], "landing footer should show @curioswhispers").to.include(
      "@curioswhispers"
    );
    expect(footerMatch[1], "landing footer should link the authorized X account").to.match(
      /<a\b(?=[^>]*\bhref="https:\/\/x\.com\/curioswhispers")(?=[^>]*\btarget="_blank")(?=[^>]*\brel="noopener noreferrer")[^>]*>\s*@curioswhispers\s*<\/a>/
    );
  });
});
