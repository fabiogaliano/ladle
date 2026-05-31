import type { Story } from "@fabiogaliano/ladle-react";
import { action } from "@fabiogaliano/ladle-react";

export const Basic: Story<{
  onClick: () => void;
}> = ({ onClick }) => {
  return (
    <>
      <button id="args-button" onClick={onClick}>
        Args
      </button>
      <button id="manual-button" onClick={action("second")}>
        Manual
      </button>
    </>
  );
};

Basic.argTypes = {
  onClick: {
    action: "clicked",
  },
};
