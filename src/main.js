const os = require("os");
const path = require("path");

const docker = require("./docker.js");

docker.build(path.join(os.homedir(), "anttest", "ant.json"), "anttest").then((config) =>
{
    console.log(config);
}, (error) =>
{
    console.log("Error:", error);
});
