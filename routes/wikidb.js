var mongo = require('mongodb');
var async = require('async');
var Server = mongo.Server,
Db = mongo.Db,
BSON = mongo.BSONPure;
var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('wikidb', server);
db.open(function(err, db) {
    if (!err) {
        console.log('Connected to \'wikidb\' database');
    }
});

function cloneDoc(doc) {
    return JSON.parse(JSON.stringify(doc));
}

// tree algorithm : http://www.sitepoint.com/hierarchical-data-database
exports.getDocumentTree = function(req, res) {
    console.log('getDocumentTree', req.body);
    var input = req.body;
    var docBase, locale, depth, url;
    var docs = [];

    if ('em' in input && 'db' in input && 'l' in input && 'u' in input && 'd' in input) {
        docBase = input.db;
        locale = input.l.toLowerCase();
        url = input.u;
        depth = Number(input.d) - 1;
    } else {
        res.send({
            sc: 2,
            sm: 'Invalid parameter'
        });
    }
    async.waterfall([
        function(cb) {
            db.collection(docBase, function(err, collection) {
                if (err) {
                    res.send({
                        sc: 1,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, collection);
                }
            });
        },
        function(collection, cb) {
            collection.findOne({url: url, locale: locale, latest: true, deletedDate: ''}, function(err, item) {
                if (err) {
                    res.send({
                        sc: 1,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    if (item) {
                        cb(null, collection, item);
                    } else {
                        res.send({
                            sc: 3,
                            sm: 'Cannot find a document'
                        });
                    }
                }
            });
        },
        function(collection, item, cb) {
            var leftLimit = Number(item.left) + Number(depth);
            var rightLimit = Number(item.right) - Number(depth);
            collection.find({
                '$or' : [
                {
                    left: { '$gte': item.left, '$lte': leftLimit }
                },
                {
                    right: { '$gte': rightLimit, '$lte': item.right }
                }
                ],
                latest: true,
                deletedDate: ''
            }).toArray(function (err, items) {
                if (err) {
                    res.send({
                        sc: 1,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    for(var i = 0; i < items.length; i++) {
                        var doc = {};
                        doc.t = items[i].title;
                        doc.u = items[i].url;
                                        doc.tp = items[i].documentType; // 0: document, 1: file storage, 2: bookmark
                                        doc.pu = items[i].parentDocumentUrl;
                                        doc.up = { // TODO with permissions
                                            v: true,
                                            m: true,
                                            a: true,
                                            d: true,
                                            ad: true,
                                        };
                                        doc.c = items[i].hasChild;
                                        docs.push(doc);
                                    }
                                    res.send({
                                        sc: 0,
                                        sm: 'Successfully get documents',
                                        uds: [],
                                        dds: docs
                                    });
                                }
                            });
}
]);
};

exports.saveDocument = function(req, res) {
    console.log('saveDocument', req.body);
    var input = req.body;
    var newDoc, url, locale, version, docBase;
    if ('em' in input && 'u' in input && 't' in input && 'c' in input && 'l' in input && 'is' in input && 'db' in input && 'v' in input) {
        docBase = input.db;
        url = input.u;
        version = String(input.v);
        locale = input.l.toLowerCase();
    } else {
        res.send({
            sc: 2,
            sm: 'Invalid parameter'
        });
    }
    async.waterfall([
        function(cb) {
            db.collection(docBase, function(err, collection) {
                if (err) {
                    res.send({
                        sc: 1,
                        sm: 'Unknown error has occurred'});
                } else {
                    cb(null, collection);
                }
            });
        },
        function(collection, cb) {
            collection.findOne({url: url, locale: locale, version: version, deletedDate: ''}, function(err, oldDoc) {
                if (oldDoc) {
                    newDoc = cloneDoc(oldDoc);
                    newDoc.latest = true;
                    newDoc.title = input.t;
                    newDoc.content = input.c;
                    newDoc.fileIds = input.is;
                    var now = new Date();
                    newDoc.createdDate = now.toUTCString();
                    newDoc.createdUserName = input.em.substring(0, input.em.indexOf('@'));
                    var newVersion = Number(newDoc.version) + 1;
                    newDoc.version = String(newVersion);
                    collection.update({ _id: oldDoc._id }, { $set: { latest : false } });
                    cb(null, collection);
                } else {
                    res.send({
                        sc: 3,
                        sm: 'Cannot find a document'
                    });
                }
            });
        },
        function(collection, cb) {
            collection.insert(newDoc, {}, function(err, result) {
                if (err) {
                    res.send({
                        sc: 1,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    res.send({
                        sc: 0,
                        sm: 'Successfully saved'
                    });
                }
            });
        }        
        ]);
};

exports.getDocument = function(req, res) {
    console.log('getDocument : ', req.body);
    var email, url, docBase, version, locale;
    var breadcrumbDocumentUrls = [];
    var breadcrumbDocumentTitles = [];
    var input = req.body;
    if ('em' in input && 'u' in input && 'db' in input && 'v' in input && 'l' in input) {
        email = input.em;
        url = input.u;
        docBase = input.db;
        version = String(input.v);
        locale = input.l.toLowerCase();
    } else {
        res.send({
            sc: 2,
            sm: 'Invalid parameter'
        });
    }
    async.waterfall([
        function(cb) {
            db.collection(docBase, function(err, collection) {
                if (err) {
                    res.send({
                        sc: 1,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, collection);
                }
            });
        },
        function(collection, cb) {
            collection.findOne({url: url, locale:locale, docBase:docBase, version:version, deletedDate: ''}, function(err, doc) {
                if (doc) {
                    cb(null, collection, doc);
                } else {
                    res.send({
                        sc: 3,
                        sm: 'Cannot find a document'
                    });
                }
            });
        },
        function(collection, doc, cb) {
            collection.find({left: {'$lte': doc.left}, right: {'$gte':doc.right}, latest: true, deletedDate: ''}).toArray(function (err, items) {
                for (var i = 0; i < items.length; i++) {
                    breadcrumbDocumentUrls.push(items[i].url);
                    breadcrumbDocumentTitles.push(items[i].title);
                }
                breadcrumbDocumentUrls.sort(function(a, b) {
                    return a.left - b.left;
                });
                breadcrumbDocumentTitles.sort(function(a, b) {
                    return a.left - b.left;
                });
                res.send({
                    sc: 0,
                    sm: 'Successfully get document',
                    t: doc.title,
                    c: doc.content,
                    v: doc.version,
                    md: doc.createdDate,
                    mun: doc.createdUserName,
                    mui: doc.createdUserId,
                    bu: breadcrumbDocumentUrls,
                    bt: breadcrumbDocumentTitles
                });
            });
        }
    ]);
}

exports.createDocument = function(req, res) {
    console.log('Create Document : ', req.body);
    var input = req.body;
    var newDoc = {};
    var docBase;
    if ('em' in input && 'db' in input && 't' in input && 'l' in input && 'u' in input && 'pu' in input) {
        docBase = input.db;
        newDoc.docBase = input.db;
        newDoc.title = input.t;
        newDoc.content = 'just created';
        newDoc.locale = input.l.toLowerCase();
        newDoc.url = input.u;
        newDoc.version = String(0);
        newDoc.fileIds = [];
        newDoc.parentDocumentUrl = input.pu;
        newDoc.hasChild = false;
        var now = new Date();
        newDoc.createdDate = now.toUTCString();
        newDoc.deletedDate = '';
        newDoc.createdUserName = input.em.substring(0, input.em.indexOf('@'));
        newDoc.createdUserId = 'todo';
        newDoc.latest = true;
        newDoc.documentType = 0;
    } else {
        res.send({
            sc: 2,
            sm: 'Invalid parameter'
        });
    }    
    async.waterfall([
        function(cb) {
            db.collection(docBase, function(err, collection) {
                if (err) {
                    res.send({
                        sc: 1,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, err, collection);
                }
            });
        },
        function(err, collection, cb) {
            collection.findOne({url: newDoc.url, locale: newDoc.locale, deletedDate: ''}, function(err, item) {
                if (!item) {
                    cb(null, err, collection);
                } else {
                    res.send({
                        sc: 4,
                        sm: 'Document url already exist'
                    });
                }
            });
        },
        function(err, collection, cb) {
            collection.findOne({url: newDoc.parentDocumentUrl, locale: newDoc.locale, deletedDate: ''}, function(err, parent) {
                if (parent) {
                    // make room to insert
                    collection.find({right:{'$gte' : parent.right}}).toArray(function (err, items) {
                        items.forEach(function (elem) {
                            collection.update({ _id : elem._id }, { $set: {right : elem.right + 2} });
                        });
                    });
                    collection.find({left:{'$gte' : parent.right}}).toArray(function (err, items) {
                        items.forEach(function (elem) {
                            collection.update({ _id : elem._id }, { $set: {right : elem.right + 2} });
                        });
                    });
                    newDoc.left = parent.right;
                    newDoc.right = parent.right + 1;
                    // mark hasChild of parent document
                    collection.update({ url: newDoc.parentDocumentUrl }, { $set: { hasChild: true } });
                } else {
                    newDoc.left = 1;
                    newDoc.right = 2;
                }
                cb(null, collection, parent);
            });
},
function(collection, parent, cb) {
    if (parent) {
        newDoc.breadcrumbDocumentUrls = [];
        newDoc.breadcrumbDocumentTitles = [];
        collection.find({left: {'$lte': parent.left}, right: {'$gte':parent.right}, latest: true, deletedDate: ''}).toArray(function (err, items) {
            for (var i = 0; i < items.length; i++) {
                newDoc.breadcrumbDocumentUrls.push(items[i].url);
                newDoc.breadcrumbDocumentTitles.push(items[i].title);
            }
            newDoc.breadcrumbDocumentUrls.push(newDoc.url);
            newDoc.breadcrumbDocumentTitles.push(newDoc.title);
            newDoc.breadcrumbDocumentUrls.sort(function(a, b) {
                return a.left - b.left;
            });
            newDoc.breadcrumbDocumentTitles.sort(function(a, b) {
                return a.left - b.left;
            });
            cb(null, collection);
        });
    } else {
        cb(null, collection);
    }
},
function(collection, cb) {
    collection.insert(newDoc, {}, function(err, result) {
        if (err) {
            res.send({
                sc: 1,
                sm: 'Unknown error has occurred'
            });
        } else {
            res.send({sc:0,
                sm: 'Successfully created',
                u: result[0].url,
                t: result[0].title,
                pu: result[0].parentDocumentUrl
            });
        }
    });
}
]);
}

exports.checkoutDocumentUrl = function(req, res) {
    console.log('checkoutDocumentUrl : ', req.body);
    var email, url, docBase;
    var input = req.body;
    if ('em' in input && 'u' in input && 'db' in input) {
        email = input.em;
        url = input.u;
        docBase = input.db;
    } else {
        res.send({
            sc: 2,
            sm: 'Invalid parameter'
        });
    }
    async.waterfall([
        function(cb) {
            db.collection(docBase, function(err, collection) {
                if (err) {
                    res.send({
                        sc: 1,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, collection);
                }
            });
        },
        function(collection, cb) {
            collection.findOne({url: url, docBase:docBase, deletedDate: ''}, function(err, doc) {
                if (doc) {
                    res.send({
                        sc: 4,
                        sm: 'Document url already exist'
                    });
                } else {
                    res.send({
                        sc: 0,
                        sm: 'Document url doesn\'t exist'
                    });
                }
            });
        }
        ]);
}

exports.deleteDocument = function(req, res) {
    console.log('deleteDocument : ', req.body);
    var email, url, docBase;
    var input = req.body;
    if ('em' in input && 'u' in input && 'db' in input) {
        email = input.em;
        url = input.u;
        docBase = input.db;
    } else {
        res.send({
            sc: 2,
            sm: 'Invalid parameter'
        });
    }
    async.waterfall([
        function(cb) {
            db.collection(docBase, function(err, collection) {
                if (err) {
                    res.send({
                        sc: 1,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, collection);
                }
            });
        },
        function(collection, cb) {
            collection.findOne({url: url, docBase: docBase, deletedDate: ''}, function(err, doc) {
                if (doc) {
                    cb(null, collection, doc);
                } else {
                    res.send({
                        sc: 3,
                        sm: 'Cannot find a document'
                    });
                }
            });
        },
        function(collection, doc, cb) {
            var now = new Date();
            var deletedDate = now.toUTCString();
            collection.find({left: {'$gte': doc.left}, right: {'$lte':doc.right}, deletedDate: ''}).toArray(function(err, items) {
                for (var i = 0; i < items.length; i++) {
                    collection.update({_id: items[i]._id},{$set: {deletedDate: deletedDate}});
                }
                res.send({
                    sc: 0,
                    sm: 'Successfully Deleted'
                });
            });
        }
    ]);
}

exports.getDocumentHistory = function(req, res) {
    console.log('getDocumentHistory : ', req.body);
    var email, url, docBase, locale, startPosition, length;
    var input = req.body;
    if ('em' in input && 'u' in input && 'db' in input && 'l' in input && 'le' in input && 's' in input) {
        email = input.em;
        url = input.u;
        docBase = input.db;
        locale = input.l.toLowerCase();
        startPosition = Number(input.s);
        length = Number(input.le);
    } else {
        res.send({
            sc: 2,
            sm: 'Invalid parameter'
        });
    }
    async.waterfall([
        function(cb) {
            db.collection(docBase, function(err, collection) {
                if (err) {
                    res.send({
                        sc: 1,
                        sm: 'Unknown error has occurred'
                    });
                } else {
                    cb(null, collection);
                }
            });
        },
        function(collection, cb) {
            collection.find({url: url}).toArray(function(err, items) {
                items.sort(function(a, b) {
                    return a.version - b.version;
                });

                if (items.length < startPosition) {
                    res.send({
                        sc: 2,
                        sm: 'Invalid parameter'
                    });
                } else {
                    var docs = [];
                    for(var i = startPosition; i < items.length; i++) {
                        var doc = {};
                        doc.t = items[i].title;
                        doc.v = items[i].version;
                        doc.n = items[i].createdUserName;
                        console.log(items[i].createdUserName);
                        doc.m = items[i].createdDate;
                        docs.push(doc);
                    }
                    res.send({
                        sc: 0,
                        sm: 'Successfully get document history',
                        vs: docs
                    });
                }
            });
        }
    ]);
}