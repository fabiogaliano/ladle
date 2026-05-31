import type { Story } from "@fabiogaliano/ladle-react";

export const StoryMeta: Story = () => {
  return <h1>Hello World, I have a meta text </h1>;
};

StoryMeta.meta = {
  myMeta: "This is my meta",
};
