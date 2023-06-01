import React, { useState, useEffect } from 'react';
import reactUse from 'react-use';
import { render, Text, useInput } from 'ink';
import { debug, Element } from './sad-copy.js'

const {useList} = reactUse;

function DebugTree(props: { children: LLMx.Node }) {
  return <></>;
}

function Inspector({componentToInspect}: {componentToInspect: any}) {
  const [steps, {push}] = useList([] as string[]);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    async function getAllFrames() {
      while (true) {
        yield debug(<DebugTree {...props}>{current}</DebugTree>);
    
        let elementToRender: LLMx.Element<any> | null = null;
        const shouldStop = (element: LLMx.Element<any>): boolean => {
          if (elementToRender === null) {
            elementToRender = element;
          }
          return element !== elementToRender;
        };
    
        // Use a closure to prevent the type from being incorrectly narrowed.
        // https://github.com/microsoft/TypeScript/issues/9998#issuecomment-235963457
        const didRenderSomething = () => elementToRender !== null;
    
        for await (const frame of LLMx.partialRenderStream(current, shouldStop)) {
          current = frame;
          yield LLMx.debug(<DebugTree {...props}>{current}</DebugTree>);
        }
    
        if (!didRenderSomething()) {
          break;
        }
      }
    }
    getAllFrames();
  }, [componentToInspect]);

  useInput((_input, key) => {
    if (key.return) {
      setFrameIndex(prevIndex => Math.min(steps.length - 1, prevIndex + 1));
    }
  });

  return <Text color="green">{steps[frameIndex]} {frameIndex}</Text>;
};

export function showInspector(componentToInspect: unknown) {
  render(<Inspector componentToInspect={componentToInspect} />);
}
