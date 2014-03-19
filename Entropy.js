/*
Password Entropy
Author: Ethan Reesor

This program is released under the MIT License as follows:

Copyright (c) 2014 Ethan Reesor (ethan.reesor@firelizzard.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/
/**
 * @name Entropy
 * @namespace
 */
var Entropy = (function () {
	/** ---------------------------------------------------------------------------
	 * Local Variables
	 */
	
	// save `this` since it is context dependent
	var _this = this;
	
	// the entropy of an arbitrary ASCII printable character
	var asciiEntropy = Math.log("~".charCodeAt(0) - " ".charCodeAt(0) + 1)/Math.log(2);
	
	// a regex that matches a letter
	var abcchar = /^[a-z]$/i;
	
	// a regex that matches a digit or '.'
	var numchar = /^[.0-9]$/i;
	
	
	
	/** ---------------------------------------------------------------------------
	 * Local Functions
	 */
	
	// escapes strings for use in regexes: http://stackoverflow.com/a/6969486/762175
	function escapeRegExp(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	}
	
	// creates a new constructor that calls the old one with the arguments array
	function appliedConstructor(constructor, arguments) {
		return constructor.bind.apply(constructor, [null].concat(arguments));
	};
	
	// overwrites part of a string with another string, at an index
	function overwriteStringWithStringAtIndex(original, index, replacement) {
		return original.substring(0, index) + replacement + original.substring(index + replacement.length);
	}
	
	// returns the case with the longest remainder or the lowest entropy
	function caseToReturn(a, b) {
		if (a == null)
			return b;
		else if (b == null)
			return a;
		else if (b.remainder.length < a.remainder.length)
			return b;
		else if (a.remainder.length < b.remainder.length)
			return a;
		else if (b.entropy < a.entropy)
			return b;
		else
			return a;
	}
	
	function getFrequencyList() {
		//var a = [], r = $('dd'); for (var i = 1; i <= 3; i++) for (var j = 0; j < r[i].children.length; j++) $.ajax({url: r[i].children[j].href, async : false, success: function (data, status, xhr) { $(data).find('#mw-content-text>table>tbody>tr').each(function (i, v) { if (i > 0) a.push([v.children[1].children[0].innerHTML.split(' ')[0], parseInt(v.children[2].innerHTML)]); }); }, dataType: 'html'});
		
		var list = [];
		var count = 0;
		
		$.ajax({
			url : 'https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists',
			async : false,
			data : 'html',
			success : function (data, status, xhr) {
				var dd = $(data).find('dd');
				for (var i = 1; i <= 3; i++)
					for (var j = 0; j < dd[i].children.length; j++)
						$.ajax({
							url: dd[i].children[j].href,
							async : false,
							data : 'html',
							success: function (data, status, xhr) {
								$(data).find('#mw-content-text>table>tbody>tr').each(function (i, v) {
									if (i > 0 && typeof v.children[1].children[0] != 'undefined' && typeof v.children[2] != 'undefined') {
										var elem, name, num;
										
										if (typeof (elem = $(v.children[1]).find('a')[0]) != 'undefined')
											name = elem.innerHTML;
										else
											console.log(v);
										
										if (isNaN(num = parseInt(v.children[2].innerHTML)))
											return;
										 
										list.push([name, num]);
										count += num;
									}
								});
							},
						});
			}
		});
		
		for (var i in list)
			list[i][1] /= count;
	}
	
	
	
	/** ---------------------------------------------------------------------------
	 * Entropy
	 */
	
	/**
	 * Provides another way to construct instances.
	 */
	this.build = {
		/**
		 * @see Tree
		 */
		tree : function () { return new appliedConstructor(_this.Tree, arguments)(); },
		
		/**
		 * @see Node
		 */
		node : function () { return new appliedConstructor(_this.Node, arguments)(); },
		
		/**
		 * @see Substitutions
		 */
		substitutions : function () { return new appliedConstructor(_this.Substitutions, arguments)(); }
	};
	
	/**
	 * Registers the constructors with the YAML parser.
	 *
	 * @this {object}
	 */
	this.register = function () {
		YAML.addType('!!wt/node', this.build.node);
		YAML.addType('!!wt/subs', this.build.substitutions);
		YAML.addType('!!wt/tree', this.build.tree);
	}.bind(this);
	
	
	
	/** ---------------------------------------------------------------------------
	 * Tree
	 */
	
	/**
	 * Constructs a Tree object.<br />
	 * <br />
	 * How the parameters are interpreted depends on what is passed. If a single
	 * object is passed, it's `root` attribute is used for the root node and it's
	 * `substitutions` attribute is used for the substitutions object. If two
	 * objects are passed, they are used for the root node and the substitutions
	 * object, respectively. If three are passed, the first is used as the root
	 * node's word list, the second as it's number list, and the third as the
	 * substitutions object. If the resulting root and substitutions objects are
	 * not yet instances of Entropy.Node and Entropy.Substitutions, they are made
	 * so by the respective constructors.
	 * 
	 * @constructor
	 * @this {Tree}
	 */
	this.Tree = function () {
		var node = null, substitutions = null;
		
		if (arguments.length == 1) {
			node = arguments[0].root;
			substitutions = argumnets[0].substitutions;
		} else if (arguments.length == 2) {
			node = arguments[0];
			substitutions = arguments[1];
		} else if (arguments.length == 3) {
			node = [arguments[0], arguments[1]];
			substitutions = arguments[2];
		} else {
			return null;
		}
		
		if (typeof node == 'object') {
			if (!(node instanceof _this.Node))
				node = new _this.Node(node);
			this.root = node;
		}
		
		if (typeof substitutions == 'object') {
			if (!(substitutions instanceof _this.Substitutions))
				substitutions = new _this.Substitutions(substitutions);
			this.substitutions = substitutions;
		}
		
		this.substitutions.parent = this;
		this.pattern.parent = this;
		
		if (typeof this.root == 'object')
			this.root.bind(this);
	};
	
	/**
	 * The Tree prototype object.
	 */
	this.Tree.fn = {
		/**
		 * @this {Tree}
		 * @see Node.fn.analyze
		 */
		analyze : function () {
			if (typeof this.root == 'object')
				return this.root.analyze.apply(this.root, arguments);
			return null;
		}
	};
	
	
	
	
	/** ---------------------------------------------------------------------------
	 * Node
	 */
	
	/**
	 * Constructs a node object or tree.<br />
	 * <ol>Cases (number of arguments):
	 * <li>The argument is interpreted as a node that is just an Object. All of the
	 * (relavent) properties are transfered to a new instance.</li>
	 * <li>The first argument is the word list, the second is the number list. A
	 * node tree is recursively constructed.</li>
	 * <li>Same as with two arguments except the third is the depth</li>
	 * </ol>
	 * The word list is expected to be an array of `[word, entropy]` pairs. If it
	 * is a simple flat array, it is reconstructed as pairs where entropy becomes
	 * the log base 2 of the array length.<br />
	 * The number list is expected to be an array of `[number, entropy,
	 * continuation, modifier]`, where `number` is the shortest recognizable
	 * portion of the number, `entropy` is the entropy of that section,
	 * `continuation` is the rest of the number's digits that Entropy will
	 * regonize, and `modifier` is a multiplicitive modifier to the entropy added
	 * by using additional digits. The additional entropy is the log base 2 of one
	 * plus the number of digits of `continuation` matched, multiplied by
	 * `modifier`. If `modifier` is not set, `0.1` will be used.
	 * 
	 * @constructor
	 * @this {Node}
	 */
	this.Node = function (words, numbers) {
		var words, numbers, depth;
		
		if (arguments.length < 1)
			return null;
		else if (arguments.length == 1) {
			var obj = arguments[0];
			var no = Object.create(_this.Node.fn);
			
			for (var k in obj) {
				k = k.toString();
				if (k.match(abcchar) || k.match(numchar) || k.length == 0)
					no[k.toLowerCase()] = obj[k];
			}
		
			return no;
		} else {
			words = arugments[0];
			numbers = arguments[1];
			depth = arguments[2];
		}
		
		if (typeof words != 'object')
			words = [];
		
		if (typeof numbers != 'object')
			numbers = [];
		
		if (typeof depth != 'number')
			depth = 0;
		
		if (words.length > 0 && words[0].length < 2) {
			var entropy = Math.log(words.length)/Math.log(2);
			for (var i in words)
				words[i] = [words[i], entropy];
		}
		
		for (var i in words) {
			var entry = words[i]
			var word = entry[0];
			var entropy = entry[1];
			
			if (typeof word[depth] == 'undefined') {
				this[''] = entropy;
				continue;
			}
			
			var c = word[depth].toLowerCase();
			
			if (typeof this[c] != 'object')
				this[c] = [];
			
			this[c].push(entry);
		}
		
		for (var i in numbers) {
			var number = numbers[i];
			var first = number[0];
			var entropy = number[1];
			var rest = number[2];
			var mul = number[3];
			
			if (typeof mul == 'undefined')
				mul = 0.1;
			
			if (depth < first.length) {
				var c = first[depth];
				
				if (typeof this[c] != 'object')
					this[c] = [];
				
				this[c].push(number);
				
				continue;
			}
			
			var past = depth - first.length;
			
			this[''] = entropy + mul * Math.log(past + 1)/Math.log(2);
			
			if (typeof rest[past] == 'undefined')
				continue;
			
			var c = rest[past];
				
			if (typeof this[c] != 'object')
				this[c] = [];
			
			this[c].push(number);
		}
		
		for (var k in this)
			if (k.match(abcchar))
				this[k] = new _this.Node(this[k], [], depth + 1);
			else if (k.match(numchar))
				this[k] = new _this.Node([], this[k], depth + 1);
	};
	
	/**
	 * The Node prototype object.
	 */
	this.Node.fn = {
		/**
		 * Binds a {Tree} to the tree of {Node}s and tells each {Node} it's key.
		 *
		 * @this {Node}
		 * @param {Tree} a tree
		 */
		bind : function (tree) {
			this.tree = tree;
			for (var k in this)
				if (k.match(abcchar) || k.match(numchar)) {
					this[k].parent = this;
					this[k].key = k;
					this[k].bind(tree);
				}
		},
		
		/**
		 * Analyzes a password to determine it's entropy.
		 * 
		 * @this {Node}
		 * @param {string} password the password
		 * @return {Analysis} the completed analysis
		 */
		analyze : function (analysis) {
			if (typeof analysis == 'string')
				analysis = new
				analysis = {
					remainder : analysis.toLowerCase(),
					matched : [],
					entropy : 0
				};
			
			var depth = arguments[1];
			if (typeof depth == 'undefined')
				depth = 0;
			
			var exhaustive = arguments[2];
			if (typeof exhaustive == 'undefined')
				exhaustive = false;
			
			var subEntropy = arguments[3];
			if (typeof subEntropy == 'undefined')
				subEntropy = 0;
			
			var c = analysis.remainder[depth];
			
			var worst = null;
			
			if ((exhaustive || typeof c == 'undefined' || !c.match(this.pattern())) && this[''])
				worst = analysis.newWithWord(depth, this, subEntropy);
				
			if (typeof c == 'undefined')
				return worst;
			
			if (typeof this[c] == 'object')
				worst = caseToReturn(worst, this[c].analyze(analysis, depth + 1, exhaustive, subEntropy));
			else {
				var s = this.substitutions(c);
				for (var i in s) {
					var c = s[i];
					if (typeof this[c[0]] == 'object')
						if (analysis.remainder.substring(depth + 1).indexOf(c.substring(1)) === 0)
							worst = caseToReturn(worst, this[c[0]].analyze(analysis.newWithSubstitution(depth, c), depth + 1, exhaustive, subEntropy + this.entropy(c[0])));
				}
			}
			
			if (typeof this.tree == 'object') {
				if (worst != null && worst.remainder.length != 0)
					worst = caseToReturn(worst, this.tree.analyze(worst, 0, exhaustive, 0));
				
				if (worst == null || exhaustive)
					worst = caseToReturn(worst, this.tree.analyze(analysis.newWithNextCharacter(), 0, exhaustive, 0));
			}
			
			return worst;
		},
		
		/**
		 * Walks backwards through the {Node} tree, using keys to construct a word.
		 * 
		 * @this {Node}
		 * @return {string} the node's word
		 */
		word : function() {
			var p = typeof this.parent == 'object' ? this.parent.word() : '';
			var s = typeof this.key == 'string' ? this.key : '';
			
			return p + s;
		},
		
		/**
		 * @this {Node}
		 * @see Pattern.get
		 */
		pattern : function () {
			if (typeof this.tree == 'object')
				return this.tree.pattern.get.apply(this.tree.pattern, arguments);
			else
				return /[a-z]/i;
		},
		
		/**
		 * @this {Node}
		 * @see Substitutions.get
		 */
		substitutions : function () {
			if (typeof this.tree == 'object')
				return this.tree.substitutions.get.apply(this.tree.substitutions, arguments);
			else
				return [];
		},
		
		/**
		 * @this {Node}
		 * @see Substitutions.entropy
		 */
		entropy : function () {
			if (typeof this.tree == 'object')
				return this.tree.substitutions.entropy.apply(this.tree.substitutions, arguments);
			else
				return NaN;
		}
	};
	
	
	
	/** ---------------------------------------------------------------------------
	 * Substitutions
	 */
	
	/**
	 * Constructs a substitutions object.<br />
	 * If there are two parameters, this calls {Substitutions.add} on them. If
	 * there is one, this loops through all of the object's properties, calling
	 * {Substitutions.add}, passing the property name and value.
	 *
	 * @constructor
	 * @this {Substitutions}
	 */
	this.Substitutions = function () {
		if (arguments.length == 2)
			this.add(arguments[0], arguments[1]);
		else
			for (var k in arguments[0])
				this.add(k, arguments[0][k]);
	};
	
	/**
	 * The Substitutions prototype object.
	 */
	this.Substitutions.fn = {
		/**
		 * Adds a character substitution to the list. If either of the parameters are
		 * arrays or objects, it is recursively flattened.
		 *
		 * @this {Substitutions}
		 * @param {string} c the character (string length should be one)
		 * @param {string} s the substitution (string length can be more than one)
		 */
		add : function (c, s) {
			if (typeof c == 'object') {
				for (var k in c)
					if (c[k].match(abcchar))
						this.add(c[k], s);
				return;
			}
			else if (typeof s == 'object') {
				for (var i in s)
					this.add(c, s[i]);
				return;
			}
			else if (typeof c != 'string')
				return;
			else if (typeof s != 'string')
				s = s.toString();
			
			c = c[0].toLowerCase();
			
			if (typeof this[c] != 'object')
				this[c] = [];
			
			if (!this.test(c, s))
				this[c].push(s);
			
			if (typeof this.parent == 'object')
				this.parent.pattern.real = undefined;
		},
		
		/**
		 * Returns a list of common letter substitutions.
		 *
		 * @this {Substitutions}
		 * @return {Array} the list
		 */
		get : function (s) {
			var a = [], m;
			
			for (var k in this)
				if (k.match(abcchar))
					if (m = this.test(k, s))
						a.push(k + m.substring(1));
			
			return a;
		},
		
		/**
		 * Tests to see if a character has a particular substitution. Matches are
		 * found based on the first character of the substitution.
		 
		 * @this {Substitutions}
		 * @param {string} c the character (string length should be one)
		 * @param {string} s the substitution (string length should be one)
		 */
		test : function (c, s) {
			if (typeof this[c] != 'object')
				return 0;
			else
				for (var i in this[c])
					if (this[c][i][0] == s[0])
						return this[c][i];
			return 0;
		},
		
		/**
		 * Calculates the added entropy of using a substitution for a character.
		 *
		 * @this {Substitutions}
		 * @param {string} c the character (string length should be one)
		 */
		entropy : function (c) {
			if (typeof this[c] != 'object')
				return NaN;
			return Math.log(this[c].length + 1)/Math.log(2);
		}
	};
	
	
	
	/** ---------------------------------------------------------------------------
	 * Pattern
	 */
	
	/**
	 * Constructs a pattern object.
	 *
	 * @constructor
	 * @this {Pattern}
	 */
	this.Pattern = function () { ; };
	
	/**
	 * The Pattern prototype object.
	 */
	this.Pattern.fn = {
		/**
		 * Flattens a substitutions array.
		 * 
		 * @private
		 */
		flatten : function (s, a) {
			if (typeof a != 'object')
				a = [];
			
			if (typeof s != 'object') {
				if (!s.match(escchar))
					s = '\\' + s;
				
				if (a.indexOf(s) < 0)
					a.push(s);
			}
			else {
				for (var k in s)
					if (k.length == 1)
						this.flatten(s[k], a);
			}
			
			return a;
		},
		
		/**
		 * Builds a regex from a substitutions array.
		 *
		 * @private
		 */
		build : function (subs) {
			return new RegExp('[a-z' + this.flatten(subs).join('') + ']', 'i');
		},
		
		/**
		 * Returns a regex pattern that matches against letters and common
		 * substitutions.
		 * 
		 * @this {Pattern}
		 * @return {RegExp} the regex
		 */
		get : function () {
			if (this.real == null)
				this.real = this.build(this.parent.substitutions);
			return this.real;
		}
	};
	
	
	
	/** ---------------------------------------------------------------------------
	 * Analysis
	 */
	
	/**
	 * Constructs an Analysis object from a string.
	 *
	 * @constructor
	 * @this {Analysis}
	 */
	this.Analysis = function (string) {
		this.remainder = string;
		this.matches = [];
		this.entropy = 0;
	};
	
	/**
	 * The Analysis prototype object.
	 */
	this.Analysis.fn = {
		newWithWord : function (depth, node, entropy) {
			var no = Object.create(_this.Analysis.fn);
			
			no.remainder = this.remainder.substring(depth);
			no.matches = this.matches.concat([[node.word(), node[''], entropy]]);
			no.entropy = this.entropy + node[''] + entropy;
			
			return no;
		},
		
		newWithSubstitution : function (depth, sub) {
			var no = Object.create(_this.Analysis.fn);
			
			no.remainder = this.remainder.substring(0, depth) + sub[0] + this.remainder.substring(depth + sub.length);
			no.matches = this.matches;
			no.entropy = this.entropy;
			
			return no;
		},
		
		newWithNextCharacter : function () {
			var no = Object.create(_this.Analysis.fn);
			
			no.remainder = this.remainder.substring(1);
			no.matches = this.matches.concat([[this.remainder[0], asciiEntropy, 0]]);
			no.entropy = this.entropy + asciiEntropy;
			
			return no;
		}
	};
	
	
	
	/** ---------------------------------------------------------------------------
	 * Stuff
	 */
	
	// each prototype needs to be set to it's respective function object to make everything happy
	this.Tree.prototype = this.Tree.fn;
	this.Node.prototype = this.Node.fn;
	this.Substitutions.prototype = this.Substitutions.fn;
	this.Pattern.prototype = this.Pattern.fn;
	this.Analysis.prototype = this.Analysis.fn;
	
	return this;
}).call({});