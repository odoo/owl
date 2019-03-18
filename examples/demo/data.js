export const messages = [];

const authors = ["Aaron", "David", "Vincent"];
const content = [
  "Lorem ipsum dolor sit amet",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem",
  "Excepteur sint occaecat cupidatat non proident"
];

function chooseRandomly(array) {
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}

for (let i = 1; i < 6000; i++) {
  messages.push({
    id: i,
    author: chooseRandomly(authors),
    msg: `${i}: ${chooseRandomly(content)}`,
    likes: 0
  });
}
