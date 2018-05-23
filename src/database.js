const bluebird = require('bluebird');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = bluebird.promisifyAll(require('fs'));

function database(db)
{
    // Self

    var self = this;

    // Methods

    self.set = function(file)
    {
        return new Promise(async function(resolve, reject)
        {
            await self.remove(file.filename);

            db.run('insert into modules values(?, ?, ?, ?);', file.filename, file.module, file.type, false, function(err)
            {
                if(err)
                    return reject(err);

                var process_dependency = function(index)
                {
                    if(index == file.dependencies.length)
                        resolve();
                    else
                    {
                        db.run('insert into dependencies values(?, ?);', file.filename, file.dependencies[index], function(err)
                        {
                            process_dependency(index + 1);
                        });
                    }
                };

                process_dependency(0);
            });
        });
    };

    self.remove = function(filename)
    {
        return new Promise(function(resolve, reject)
        {
            db.run('delete from modules where file = ?;', filename, function(err)
            {
                if(err)
                    return reject(err);

                db.run('delete from dependencies where file = ?', filename, function(err)
                {
                    if(err)
                        return reject(err);

                    resolve();
                });
            });
        });
    };

    self.each = {};

    self.each.filename = function(callback)
    {
        return new Promise(function(resolve, reject)
        {
            db.all('select file from modules;', function(err, rows)
            {
                if(err)
                    return reject(err);

                rows.forEach(function(row)
                {
                    callback(row.file);
                });

                resolve();
            });
        });
    };
};

module.exports = async function(root)
{
    try
    {
        await fs.statAsync(path.join(root, '.ant', 'database'));
        return new database(new sqlite3.Database(path.join(root, '.ant', 'database')));
    }
    catch(_)
    {
        try
        {
            await fs.statAsync(path.join(root, '.ant'));
        }
        catch(_)
        {
            fs.mkdirAsync(path.join(root, '.ant'));
        }

        var db = new sqlite3.Database(path.join(root, '.ant', 'database'));

        db.serialize(function()
        {
            db.run('create table globals(last_run unsigned int64);');
            db.run('create table modules(file text, module text, type char(1), built boolean);');
            db.run('create table dependencies(file text, module text);');

            db.run('create index modules_file_idx on modules(file);');
            db.run('create index modules_module_type_idx on modules(module, type);');
            db.run('create index modules_built_idx on modules(built);');
            db.run('create index dependencies_file_idx on dependencies(file);');
            db.run('create index dependencies_module_idx on dependencies(module);');

            db.run('insert into globals values(0);');
        });

        return new database(db);
    }
};
