const fs = require("fs");

function build(antfile, imagename)
{
    return new Promise((resolve, reject) =>
    {
        fs.readFile(antfile, (error, data) =>
        {
            if(error != null)
                return reject(error);

            config = JSON.parse(data);
        });
    });
}

module.exports = {
    build: build
};
