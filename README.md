
---

06 Oct 2015 - node-red-contrib-leveldb-ttl
------------------------------------------

Install
-------

Run the following command in the root directory of your Node-RED install

    npm install node-red-contrib-leveldb-ttl
   
    or

    npm install git://github.com/min0n/node-red-contrib-leveldb-ttl.git

Usage
-----

This is a quick and dirty <a href="http://nodered.org" target="_new">Node-RED</a> package to add <a href="https://github.com/Level/level-ttl" target="_new"><i>Level-ttl</i></a> support to the original <a href="https://github.com/node-red/node-red-nodes/tree/master/storage/leveldb" target="_new"><i>node-red-node-leveldb</i></a> code (version 0.0.5), and to wrap some <a href="https://github.com/Level/levelup" target="_new"><i>Levelup</i></a> functions, like batch and streams.

Use one node to either <b>put</b> (store) the <b>msg.payload</b> to the named database file, using <b>msg.topic</b> as the key, or to <b>delete</b> information select delete in the properties dialogue and again use <b>msg.topic</b> as the key.</b>.

Use the other node to <b>get</b>, or retrieve the data already saved in the database.

Again use <b>msg.topic</b> to hold the <i>key</i> for the database, and the result is returned in <b>msg.payload</b>. If nothing is found for the key then <i>null</i> is returned.

The configuration node allows to set the database <b>Default TTL</b>in seconds (0: disabled), and <b>Scan TTL</b> to set the internal scan in seconds. The <b>Default TTL</b> can be overriden.

The node to <b>get</b> from the database works as the original. 

Some info about the new nodes:

<b>Stream</b> node: The configuration of this node defines the default <b>type of stream</b>: ReadStream, KeyStream or ValueStream. This can be overriden using <b>msg.payload.keys</b> and <b>msg.payload.values</b>. The range of keys that are streamed can be set by using <b>msg.payload.start</b>, <b>msg.payload.end</b>, <b>msg.payload.lt</b>, <b>msg.payload.gt</b> or <b>msg.payload.limit</b>.  If no options are passed, it streams the entire database.
Example:
msg.payload = {
    keys: true,
    values: false,
    start: 'key1~',
    end: 'key1~~'
}

<b>Batch</b> node: can be used for very fast bulk-write operations (both put and delete). <b>msg.payload</b> should contain a list of operations to be executed sequentially, although as a whole they are performed as an atomic operation inside LevelDB. 
Example:
msg.payload =[
                {type: 'put', key: 'key1', value: 123},
                {type: 'del', key: 'key2'}
            ]


<b>Batch2</b> node: This node get individuals operations and push them in a buffer before doing the batch operation to the database. The configuration of this node allows to set the buffer size. 

<b>KeyTTL</b> node: This node can serve to insert or update a ttl for any given key from <b>msg.topic</b> in the database (even if that key doesn't exist but may in the future). 


The configuration of the nodes to <b>put</b>, to <b>batch</b> and the <b>keyttl</b> node, include a <b>Node TTL</b> parameter to override the <b>Default TTL</b>. Also, <b>Node TTL</b> can be individually overriden by a <b>msg.ttl</b>.




