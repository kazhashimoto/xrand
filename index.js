const { program } = require('commander');
const zlib = require('node:zlib');
const MersenneTwister = require('mersenne-twister');
let mt = new MersenneTwister();

const { xrand } = require('./xrand');
const { randIntegers } = require('./rand-samples');

program
  .name('index.js')
  .usage('[options]')
  .showHelpAfterError()
  .option('-m,--method <id>', 'generater id', 'mt')
  .option('-n <size>', 'generate 0...n values', 5)
  .option('-t <count>', 'number of trials', 10)
  .option('-b <base>', 'set min value of the range to <base>', 0)
  .option('--bitstream', 'output bitstream for -n 1')
  .option(
    '-s,--stat',
    'display frequency distribution of the generated random values'
  )
  .option('--test <name>', 'run the test specified by name')
  .option('-u,--unadjusted', 'dsisable the randum number adjustment')
  .option('--ref', 'use reference sample of random numbers')
  .option('--coupon', 'count Coupon collector')
  .option('-l', 'print length values of Coupon collector')
  .option('-i', 'display generator info')
  .option('-d,--debug', 'display debug info');

program.parse(process.argv);
const options = program.opts();

const method = new Map();
method.set('mt', () => mt.random()).set('math', () => Math.random());

const not_supported_error = (m) => {
  console.error(`Error: ${m} not supported`);
  process.exit(1);
};

const xrandConfig = {};
if (method.has(options.method)) {
  xrandConfig.generator = method.get(options.method);
} else {
  not_supported_error(options.method);
}

if (options.unadjusted) {
  xrandConfig.mode = 'unadjusted';
}
if (options.ref) {
  xrandConfig.mode = 'ref';
  xrandConfig.refData = randIntegers;
}

xrand(0, 0, xrandConfig);
console.error(options);

function test_rand() {
  mt = new MersenneTwister();
  const RAND_MAX = +options.n;
  const trials = +options.t;
  const stat = new Array(RAND_MAX + 1).fill(0);
  for (let i = 0; i < trials; i++) {
    const n = xrand(0, RAND_MAX);
    stat[n]++;
  }
  console.log(stat);
  const min = Math.min(...stat);
  const max = Math.max(...stat);
  console.log(`min=${min}, max=${max}, range=${max - min}`);
}

// Fisher–Yates
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const r = xrand(0, i);
    [array[i], array[r]] = [array[r], array[i]];
  }
}

function test_shuffle() {
  const arr = Array.from({ length: +options.n }, (v, i) => i);
  console.log('### shuffle test ###');
  for (let i = 0; i < +options.t; i++) {
    shuffle(arr);
    console.log(arr);
  }
}

function test_list() {
  const low = +options.b;
  for (let i = 1; i < 12; i++) {
    let high = low + i;
    const arr = Array.from({ length: +options.t }, () => xrand(low, high));
    console.log(`[${low}...${high}]: `, arr.join(', '));
  }
}

function test_generate() {
  const n = +options.n;
  const low = +options.b;
  const high = low + n;
  const arr = Array.from({ length: +options.t }, () => xrand(low, high));
  const delim = options.bitstream && n === 1 ? '' : ', ';
  const sequence = arr.join(delim);
  console.log(`[${low}...${high}]: `, sequence);
  console.log('\n');
  frequency(arr, n, low);

  const comp = zlib.deflateSync(sequence);
  let deflated = 100 * (1 - comp.length / sequence.length);
  console.log(
    `compressed: ${sequence.length} -> ${
      comp.length
    } bytes, deflated ${deflated.toFixed(2)}%`
  );
}

function frequency(arr, n, offset) {
  const freq = new Array(n + 1).fill(0);
  for (const v of arr) {
    freq[v - offset]++;
  }
  console.log(`frequency: ${freq.join(', ')}`);
  const min = Math.min(...freq);
  const max = Math.max(...freq);
  console.log(`min=${min}, max=${max}, range=${max - min}`);
}

function coupon_collect(high) {
  const arr = [];
  const coupon = new Array(high + 1).fill(0);

  while (coupon.filter((v) => v === 0).length > 0) {
    const x = xrand(0, high);
    arr.push(x);
    coupon[x]++;
  }
  const sequence = arr.join(', ');
  console.log(`[0...${high}] complete at length ${arr.length}: `, sequence);
  return arr.length;
}

function test_CouponCollector() {
  const n = +options.n;
  const count = +options.t;
  const arr = [];
  let total = 0;
  let min = undefined,
    max = undefined;
  let seed = Date.now();
  for (let i = 0; i < count; i++) {
    mt = new MersenneTwister(seed++);
    xrand(0, 0, 'reset');
    const len = coupon_collect(n);
    if (typeof min === 'undefined') {
      min = len;
      max = len;
    } else {
      if (len < min) {
        min = len;
      }
      if (len > max) {
        max = len;
      }
    }
    total += len;
    arr.push(len);
  }
  const mean = (total / count).toFixed(1);
  console.log('');
  console.log(`mean ${mean}, min ${min}, max ${max}`);

  let expected = 0;
  for (let i = 1; i <= n + 1; i++) {
    expected += 1 / i;
  }
  expected *= n + 1;
  console.log(`expected ${expected.toFixed(1)}`);
  if (options.l) {
    console.log('length: ', arr.join(', '));
  }
  console.log('len < expected: ', arr.filter((v) => v < expected).length);
  if (options.i) {
    xrand(0, 0, 'info');
  }
}

const testMap = new Map();
testMap.set('shuffle', test_shuffle);
testMap.set('list', test_list);

if (options.stat) {
  test_rand();
} else if (options.test) {
  let handler = testMap.get(options.test);
  if (!handler) {
    console.log(`Test ${options.test} not found`);
    process.exit(1);
  }
  handler();
} else if (options.coupon) {
  test_CouponCollector();
} else {
  test_generate();

  if (options.debug || options.i) {
    const level = options.debug ? 'stat' : 'info';
    xrand(0, 0, level);
  }
}
