//------------------------------------------------------------------------------
// Generating demo data
//------------------------------------------------------------------------------
const AUTHORS = ["Aaron", "David", "Vincent"];
const CONTENT = [
  "Lorem ipsum dolor sit amet",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem",
  "Excepteur sint occaecat cupidatat non proident"
];

function chooseRandomly(array) {
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}

let nextId = 1;
export function buildData(n = 1000) {
  const data = [];
  for (let i = 0; i < n; i++) {
      let id = nextId++;
    data.push({
      id: id,
      author: chooseRandomly(AUTHORS),
      msg: `${id}: ${chooseRandomly(CONTENT)}`,
      likes: 0
    });
  }
  return data;
}

//------------------------------------------------------------------------------
// Measuring helpers
//------------------------------------------------------------------------------
let startTime;
let lastMeasure;
export function startMeasure(descr) {
  startTime = performance.now();
  lastMeasure = descr;
}
export function stopMeasure() {
  let last = lastMeasure;
  if (lastMeasure) {
    window.setTimeout(function() {
      lastMeasure = null;
      const stop = performance.now();
      console.log(`[${last}] took  ${Number(stop - startTime).toFixed()}ms`);
    }, 0);
  }
}
