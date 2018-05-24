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
            db.run('delete from modules where file = ?;', file.filename, function(err)
            {
                if(err)
                    return reject(err);

                db.run('delete from dependencies where file = ?;', file.filename, function(err)
                {
                    if(err)
                        return reject(err);

                    db.run('insert into modules values(?, ?, ?, \'R\');', file.filename, file.module, file.type, function(err)
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
            });
        });
    };

    self.remove = function(filename)
    {
        return new Promise(function(resolve, reject)
        {
            db.run('update modules set status = \'G\' where file = ?;', filename, function(err)
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

    self.refresh = function()
    {
        var built = function()
        {
            return new Promise(function(resolve, reject)
            {
                db.get('select count(*) from modules where status = \'B\';', function(err, row)
                {
                    if(err)
                        return reject(err);

                    resolve(row['count(*)']);
                });
            });
        };

        return new Promise(async function(resolve, reject)
        {
            built.last = await built();

            function recursion()
            {
                db.run('update modules set status = \'R\' where status = \'B\' and (file in (select distinct(file) from dependencies where module in (select distinct(module) from modules where (type = \'I\' or type = \'H\') and status != \'B\'))) or (module in (select distinct(module) from modules where (type = \'I\' or type = \'H\') and status != \'B\'));', async function(err)
                {
                    if(err)
                        return reject(err);

                    built.new = await built();

                    if(built.new != built.last)
                    {
                        built.last = built.new;
                        recursion();
                    }
                    else
                        db.run('delete from modules where status = \'G\';', function(err)
                        {
                            if(err)
                                return reject(err);

                            resolve();
                        })
                });
            };

            recursion();
        });
    };

    self.errors = function()
    {
        return new Promise(function(resolve, reject)
        {
            var errors = [];

            db.all('select distinct module as M from modules where (select count(*) from modules where module = M and type = \'I\') = 0;', function(err, rows)
            {
                if(err)
                    return reject(err);

                rows.forEach(function(row)
                {
                    errors.push({type: 'no-interface', module: row.M});
                });

                db.all('select distinct(module) as M from modules where (select count(*) from modules where module = M and type = \'I\') > 1;', function(err, rows)
                {
                    if(err)
                        return reject(err);

                    rows.forEach(function(row)
                    {
                        errors.push({type: 'multiple-interfaces', module: row.M});
                    });

                    db.all('select file, module as M from dependencies where (select count(*) from modules where module = M) == 0;', function(err, rows)
                    {
                        if(err)
                            return reject(err);

                        rows.forEach(function(row)
                        {
                            errors.push({type: 'missing-dependency', file: row.file, module: row.M});
                        });

                        db.all('select distinct modules.module as source, dependencies.module as destination from modules, dependencies where dependencies.file in (select file from modules where module = source);', function(err, rows)
                        {
                            if(err)
                                return reject(err);

                            dependencies = {};

                            rows.forEach(function(row)
                            {
                                if(!(dependencies[row.source]))
                                    dependencies[row.source] = [];

                                dependencies[row.source].push(row.destination);
                            });

                            var cycles = function(dependencies)
                            {
                                var cycles = [];

                                var explore = function(root, module, path)
                                {
                                    if(dependencies[module])
                                        for(var index = 0; index < dependencies[module].length; index++)
                                        {
                                            if(dependencies[module][index] == root)
                                                return path;

                                            if(path.indexOf(dependencies[module][index]) != -1)
                                                continue;

                                            var branch = explore(root, dependencies[module][index], path.concat([dependencies[module][index]]));

                                            if(branch)
                                                return branch;
                                        }
                                };

                                for(var module in dependencies)
                                {
                                    var cycle = explore(module, module, [module]);
                                    if(cycle)
                                        cycles.push(cycle);
                                }

                                var equal = function(alpha, beta)
                                {
                                    if(alpha.length != beta.length)
                                        return false;

                                    for(var index = 0; index < alpha.length; index++)
                                        if(alpha[index] != beta[index])
                                            return false;

                                    return true;
                                };

                                var minidx = function(arr)
                                {
                                    var minidx = 0;

                                    for(var index = 1; index < arr.length; index++)
                                        if(arr[index] < arr[minidx])
                                            minidx = index;

                                    return minidx;
                                }

                                var rotate = function(arr)
                                {
                                    var idx = minidx(arr);
                                    return arr.slice(idx).concat(arr.slice(0, idx));
                                }

                                for(var index = 0; index < cycles.length; index++)
                                    cycles[index] = rotate(cycles[index]);

                                for(var alpha = 0; alpha < cycles.length; alpha++)
                                    for(var beta = alpha + 1; beta < cycles.length; beta++)
                                    {
                                        if(equal(cycles[alpha], cycles[beta]))
                                        {
                                            cycles.splice(beta, 1);
                                            beta--;
                                        }
                                    }

                                return cycles;
                            };

                            cycles(dependencies).forEach(function(cycle)
                            {
                                errors.push({type: 'cyclic-dependency', cycle: cycle});
                            });

                            resolve(errors);
                        });
                    });
                });
            });
        });
    };

    self.each = {};

    self.each.filename = function(callback)
    {
        return new Promise(function(resolve, reject)
        {
            db.all('select file from modules;', async function(err, rows)
            {
                if(err)
                    return reject(err);

                for(var index = 0; index < rows.length; index++)
                    await callback(rows[index].file);

                resolve();
            });
        });
    };

    self.last_run = function()
    {
        return new Promise(function(resolve, reject)
        {
            db.get('select last_run from globals;', function(err, row)
            {
                if(err)
                    return reject(err);

                resolve(new Date(row.last_run));
            });
        });
    };

    self.last_run.set = function(timestamp)
    {
        return new Promise(function(resolve, reject)
        {
            db.run('update globals set last_run = ?;', timestamp.getTime(), function(err)
            {
                if(err)
                    return reject(err);

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
            db.run('create table modules(file text, module text, type char(1), status char(1));');
            db.run('create table dependencies(file text, module text);');

            db.run('create index modules_file_idx on modules(file);');
            db.run('create index modules_module_type_idx on modules(module, type);');
            db.run('create index modules_status_idx on modules(status);');
            db.run('create index dependencies_file_idx on dependencies(file);');
            db.run('create index dependencies_module_idx on dependencies(module);');

            db.run('insert into globals values(0);');
        });

        return new database(db);
    }
};
