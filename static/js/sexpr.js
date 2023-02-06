// var parse = require('s-expression');
// import { SParse as parse } from "../node_modules/s-expression/index.js";
// module.exports = { parseau };
// export { parseau };

// Construct Autumn Expression (AExpr) from program string
function parseau(program_str) {
  var sexpr = SParse(program_str);
  var aexpr = s_to_a(sexpr); 
  return aexpr;
}

// Convert S-Expression (SExpr) to Autumn Expression (AExpr)
function s_to_a(sexpr) {
  if (Array.isArray(sexpr)) { 
    if (sexpr[0] == "program") {
      return {"head" : "program", "args" : sexpr.slice(1).map(line => s_to_a(line))};
    } else if (sexpr[0] == "if") {
      return {"head" : "if", "args" : [s_to_a(sexpr[1]), s_to_a(sexpr[3]), s_to_a(sexpr[5])]};
    } else if (sexpr[0] == "initnext") {
      return {"head" : "initnext", "args" : [s_to_a(sexpr[1]), s_to_a(sexpr[2])]};
    } else if (sexpr[0] == "=") {
      return {"head" : "assign", "args" : [sexpr[1], s_to_a(sexpr[2])]};
    } else if (sexpr[0] == ":") {
      return {"head" : "typedecl", "args" : [sexpr[1], s_to_a(sexpr[2])]};
    } else if (sexpr[0] == "let") {
      return {"head" : "let", "args" : sexpr[1].map(line => s_to_a(line))};
    } else if (sexpr[0] == "fn") {
      return {"head" : "fn", "args" : [{"head" : "list", "args" : sexpr[1]}, s_to_a(sexpr[2])]};
    } else if (sexpr[0] == "-->") {
      return {"head" : "lambda", "args" : [s_to_a(sexpr[1]), s_to_a(sexpr[2])]};
    } else if (sexpr[0] == "..") {
      return {"head" : "field", "args" : [s_to_a(sexpr[1]), s_to_a(sexpr[2])]};
    } else if (sexpr[0] == "list") {
      return {"head" : "list", "args" : sexpr.slice(1).map(elt => s_to_a(elt))};
    } else if (sexpr[0] == "on") {
      return {"head" : "on", "args" : [s_to_a(sexpr[1]), s_to_a(sexpr[2])]};
    } else if (sexpr[0] == "object") {
      return {"head" : "object", "args" : sexpr.slice(1).map(elt => s_to_a(elt))};
    } else if (sexpr.length > 1) {
      return {"head" : "call", "args" : [s_to_a(sexpr[0]), sexpr.slice(1).map(s => s_to_a(s))]};
    } else {
      return {"head" : "list", "args" : sexpr.slice(1).map(elt => s_to_a(elt))};
    } 
  } else if (!isNaN(sexpr)) {
    return parseInt(sexpr);
  } else if (typeof(sexpr) == "string") {
    return sexpr;
  } else {
    return {"str" : sexpr.valueOf()};
  }
}

function SParser(stream) {
  this._line = this._col = this._pos = 0;
  this._stream = stream;
}

SParser.not_whitespace_or_end = /^(\S|$)/;
SParser.space_quote_paren_escaped_or_end = /^(\s|\\|"|'|`|,|\(|\)|$)/;
SParser.string_or_escaped_or_end = /^(\\|"|$)/;
SParser.string_delimiters = /["]/;
SParser.quotes = /['`,]/;
SParser.quotes_map = {
  '\'': 'quote',
  '`':  'quasiquote',
  ',':  'unquote'
};

SParser.prototype = {
  peek: peek,
  consume: consume,
  until: until,
  error: error,
  string: string,
  atom: atom,
  quoted: quoted,
  expr: expr,
  list: list
};

function SParse(stream) {
  var parser = new SParse.Parser(stream);
  var expression = parser.expr();

  if (expression instanceof Error) {
      return expression;
  }

  // if anything is left to parse, it's a syntax error
  if (parser.peek() != '') {
      return parser.error('Superfluous characters after expression: `' + parser.peek() + '`');
  }

  return expression;
};

// module.exports.Parser = SParser;
// module.exports.SyntaxError = Error;

// export {SParse, SParser as Parser };

function error(msg) {
  var e = new Error('Syntax error: ' + msg);
  e.line = this._line + 1;
  e.col  = this._col + 1;
  return e;
}

function peek() {
  if (this._stream.length == this._pos) return '';
  return this._stream[this._pos];
}

function consume() {
  if (this._stream.length == this._pos) return '';

  var c = this._stream[this._pos];
  this._pos += 1;

  if (c == '\r') {
      if (this.peek() == '\n') {
          this._pos += 1;
          c += '\n';
      }
      this._line++;
      this._col = 0;
  } else if (c == '\n') {
      this._line++;
      this._col = 0;
  } else {
      this._col++;
  }

  return c;
}

function until(regex) {
  var s = '';

  while (!regex.test(this.peek())) {
      s += this.consume();
  }

  return s;
}

function string() {
  // consume "
  var delimiter = this.consume();

  var str = '';

  while (true) {
      str += this.until(SParser.string_or_escaped_or_end);
      var next = this.peek();

      if (next == '') {
          return this.error('Unterminated string literal');
      }

      if (next == delimiter) {
          this.consume();
          break;
      }

      if (next == '\\') {
          this.consume();
          next = this.peek();

          if (next == 'r') {
              this.consume();
              str += '\r';
          } else if (next == 't') {
              this.consume();
              str += '\t';
          } else if (next == 'n') {
              this.consume();
              str += '\n';
          } else if (next == 'f') {
              this.consume();
              str += '\f';
          } else if (next == 'b') {
              this.consume();
              str += '\b';
          } else {
              str += this.consume();
          }

          continue;
      }

      str += this.consume();
  }

  // wrap in object to make strings distinct from symbols
  return new String(str);
}

function atom() {
  if (SParser.string_delimiters.test(this.peek())) {
      return this.string();
  }

  var atom = '';

  while (true) {
      atom += this.until(SParser.space_quote_paren_escaped_or_end);
      var next = this.peek();

      if (next == '\\') {
          this.consume();
          atom += this.consume();
          continue;
      }

      break;
  }

  return atom;
}

function quoted() {
  var q = this.consume();
  var quote = SParser.quotes_map[q];

  if (quote == "unquote" && this.peek() == "@") {
      this.consume();
      quote = "unquote-splicing";
      q = ',@';
  }

  // ignore whitespace
  this.until(SParser.not_whitespace_or_end);
  var quotedExpr = this.expr();

  if (quotedExpr instanceof Error) {
      return quotedExpr;
  }

  // nothing came after '
  if (quotedExpr === '') {
      return this.error('Unexpected `' + this.peek() + '` after `' + q + '`');
  }

  return [quote, quotedExpr];
}

function expr() {
  // ignore whitespace
  this.until(SParser.not_whitespace_or_end);

  if (SParser.quotes.test(this.peek())) {
      return this.quoted();
  }

  var expr = this.peek() == '(' ? this.list() : this.atom();

  // ignore whitespace
  this.until(SParser.not_whitespace_or_end);

  return expr;
}

function list() {
  if (this.peek() != '(') {
      return this.error('Expected `(` - saw `' + this.peek() + '` instead.');
  }

  this.consume();

  var ls = [];
  var v = this.expr();

  if (v instanceof Error) {
      return v;
  }

  if (v !== '') {
      ls.push(v);

      while ((v = this.expr()) !== '') {
          if (v instanceof Error) return v;
          ls.push(v);
      }
  }

  if (this.peek() != ')') {
      return this.error('Expected `)` - saw: `' + this.peek() + '`');
  }

  // consume that closing paren
  this.consume();

  return ls;
}
