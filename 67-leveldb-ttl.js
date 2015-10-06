/**
 * Copyright 2013,2015 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * 06 Oct - 2015 added TTL, Readers and Batch support. by min0n
 *
 **/

module.exports = function(RED) {
    "use strict";
    var lvldb = require('level'),
        lvlttl = require('level-ttl');

    function LevelNode(n) {
        RED.nodes.createNode(this,n);
        this.dbname = n.db;
        this.defaultttl = n.defaultttl;
        this.checkfreq = n.checkfreq;
        this.ready = false;
        var node = this;
        lvldb(this.dbname, function(err, db) {
            if (err) { node.error(err); }
            //console.log('default ttl (s)='+node.defaultttl+' checkfreq (s)='+node.checkfreq);
            node.db = lvlttl(db,{defaultTTL: 1000*node.defaultttl, checkFrequency: 1000*node.checkfreq }); //s to msec
            node.db.on('ready', function() { node.ready = true; });
            node.db.on('closing', function() { node.ready = false; });
        });
        node.on('close', function() {
            if (node.db) {
                node.ready = false;
                node.db.close();
            }
        });
    }
    RED.nodes.registerType("leveldbttlbase",LevelNode);


    function LevelDBNodeIn(n) {
        RED.nodes.createNode(this,n);
        this.level = n.level;
        this.levelConfig = RED.nodes.getNode(this.level);

        var node = this;
        node.on("input", function(msg) {
            if (node.levelConfig && node.levelConfig.ready) {
                var key = msg.topic.toString();
                if (key && (key.length > 0)) {
                    node.levelConfig.db.get(msg.topic, function(err, value) {
                        if (err) {
                            //node.warn(err);
                            // for some reason they treat nothing found as an error...
                            msg.payload = null;  // so we should return null
                        }
                        else { msg.payload = value; }
                        node.send(msg);
                    });
                }
                else { node.error("Cannot make key string from msg.topic"); }
            }
            else { node.error("Database not ready",msg); }
        });
    }
    RED.nodes.registerType("leveldb-ttl in",LevelDBNodeIn);


    function LevelDBNodeOut(n) {
        RED.nodes.createNode(this,n);
        this.level = n.level;
        this.operation = n.operation;
        this.nodettl = n.nodettl;
        this.levelConfig = RED.nodes.getNode(this.level);

        var node = this;
        console.log('nodettl dice '+node.nodettl+' default ttl dice '+node.levelConfig.defaultttl);
        node.on("input", function(msg) {
            if (node.levelConfig && node.levelConfig.ready) {
                var key = msg.topic.toString();
                if (key && (key.length > 0)) {
                    if (node.operation === "delete") {
                        node.levelConfig.db.del(msg.topic);
                    }
                    else {
                        
                        var ttl = (msg.hasOwnProperty('ttl') && msg.ttl>0) ? msg.ttl : node.nodettl; //msg ttl overrides defined node ttl
                        
                        if (ttl > 0) //override default ttl?
                        {
                            node.levelConfig.db.put(msg.topic, msg.payload,{ttl: ttl*1000 },function(err) {
                                if (err) { node.error(err); }
                            });
                            
                        }else //not ttl or default ttl.
                        {
                            node.levelConfig.db.put(msg.topic, msg.payload, function(err) {
                                if (err) { node.error(err); }
                            });
                        }
                        
                        
                    }
                }
                else { node.error("Cannot make key string from msg.topic"); }
            }
            else { node.error("Database not ready",msg); }
        });
    }
    RED.nodes.registerType("leveldb-ttl out",LevelDBNodeOut);
    
    
    
    //06 oct 2015. new nodes
    
    function LevelDBNodeStream(n) {
        RED.nodes.createNode(this,n);
        this.level = n.level;
        this.stype = n.stype;
        this.levelConfig = RED.nodes.getNode(this.level);

        var node = this;
        node.on("input", function(msg) {
            if (node.levelConfig && node.levelConfig.ready) {
                var options = msg.payload || {};
                
                var values = (node.stype != "key");
                var keys = (node.stype != "value");
                
                //override node stream type 
                options.values = options.hasOwnProperty('values') ? options.values : values ;
                options.keys = options.hasOwnProperty('keys') ? options.keys : keys ;
                    
                if (options.values && options.keys)//(node.stype == "read")
                {
                    var readStream =  node.levelConfig.db.createReadStream(options);
                    readStream.on('data',function (data) {
                        msg.topic = data.key;
                        msg.payload = data.value;
                        node.send(msg);
                    });
                }else if (options.keys)
                {
                    var keyStream =  node.levelConfig.db.createKeyStream(options);
                    keyStream.on('data',function (data) {
                        //msg.topic = data.key;
                        msg.payload = data.key;
                        node.send(msg);
                    });
                }else //if (node.stype == "value")
                {
                    var valueStream =  node.levelConfig.db.createValueStream(options);
                    valueStream.on('data',function (data) {
                        //msg.topic = data.key;
                        msg.payload = data.value;
                        node.send(msg);
                    });
                
                }
            }
            else { node.error("Database not ready",msg); }
        });
    }
    RED.nodes.registerType("leveldb-ttl stream",LevelDBNodeStream);

    function LevelDBNodeKeyTTL(n) {
        RED.nodes.createNode(this,n);
        this.level = n.level;
        this.nodettl = n.nodettl;
        this.levelConfig = RED.nodes.getNode(this.level);

        var node = this;
        console.log('LevelDBNodeKeyTTL:: nodettl dice '+node.nodettl+' default ttl dice '+node.levelConfig.defaultttl);
        node.on("input", function(msg) {
            if (node.levelConfig && node.levelConfig.ready) {
                var key = msg.topic.toString();
                if (key && (key.length > 0)) {
                    var ttl = (msg.hasOwnProperty('ttl') && msg.ttl>0) ? msg.ttl : node.nodettl; //msg ttl overrides defined node ttl
                    if (ttl > 0) //override default ttl?
                    {
                        console.log('override default ttl '+ttl);
                        node.levelConfig.db.ttl(msg.topic,{ttl: ttl*1000 },function(err) {
                            if (err) { node.error(err); }
                        });        
                    }else //set default ttl if any
                    {
                        node.levelConfig.db.ttl(msg.topic,{ttl: node.levelConfig.defaultttl*1000 },function(err) {
                            if (err) { node.error(err); }
                        });        
                    }
                }
                else { node.error("Cannot make key string from msg.topic"); }
            }
            else { node.error("Database not ready",msg); }
        });
    }
    RED.nodes.registerType("leveldb-ttl keyttl",LevelDBNodeKeyTTL);

    
     function LevelDBNodeBatchOut(n) {
        RED.nodes.createNode(this,n);
        this.level = n.level;
        this.nodettl = n.nodettl;
        this.levelConfig = RED.nodes.getNode(this.level);

        var node = this;
        console.log('LevelDBNodeBatchOut:: nodettl dice '+node.nodettl+' default ttl dice '+node.levelConfig.defaultttl);
        node.on("input", function(msg) {
            if (node.levelConfig && node.levelConfig.ready) {
                var ttl = (msg.hasOwnProperty('ttl') && msg.ttl>0) ? msg.ttl : node.nodettl; //msg ttl overrides defined node ttl
                if (ttl>0) //override default ttl?
                {
                    node.levelConfig.db.batch(msg.payload,{ttl: ttl*1000 },function(err) {
                        if (err) { node.error(err); }
                    });   
                }else //set default ttl if any
                {
                     node.levelConfig.db.batch(msg.payload,{ttl: node.levelConfig.defaultttl*1000 },function(err) {
                         if (err) { node.error(err); }
                     });        
                }
            }
            else { node.error("Database not ready",msg); }
        });
    }
    RED.nodes.registerType("leveldb-ttl batchout",LevelDBNodeBatchOut);
    
    function LevelDBNodeBatchOut2(n) {
        RED.nodes.createNode(this,n);
        this.level = n.level;
        this.nodettl = n.nodettl;
        this.batchsize = n.batchsize;
        this.buffer = [];
        this.levelConfig = RED.nodes.getNode(this.level);

        var node = this;
        
        
        console.log('LevelDBNodeBatchOut2:: nodettl dice '+node.nodettl+' default ttl dice '+node.levelConfig.defaultttl);
        node.on("input", function(msg) {
            if (node.levelConfig && node.levelConfig.ready) {
                node.buffer.push(msg.payload);
                console.log("LevelDBNodeBatchOut2:: array "+node.buffer.length);
                
               if (node.buffer.length > 0) {
                     node.status({text:node.buffer.length});
                }

                if (node.buffer.length >= node.batchsize) //do batch
                {
                    console.log("yupi doing batch!!!");
                    var ttl = (node.nodettl) > 0 ? node.nodettl : node.levelConfig.defaultttl; //msg ttl overrides defined node ttl
                    
                    node.levelConfig.db.batch(node.buffer,{ttl: ttl*1000 },function(err) {
                        if (err) { node.error(err); }
                    });        
                    
                    node.buffer = []; //reset array
                }
            }
            else { node.error("Database not ready",msg); }
        });
    }
    RED.nodes.registerType("leveldb-ttl batchout2",LevelDBNodeBatchOut2);
    
    
}
