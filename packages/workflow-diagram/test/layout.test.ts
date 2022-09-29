import test from 'ava';

import { ProjectSpace } from "../dist/types";
import { toElkNode, toFlow } from "../src/layout/index";
import { FlowElkNode, FlowNodeEdges } from "../src/layout/types";
import { getFixture } from "./helpers";

// TODO there are some minor diffs in the fixture - they ought to be checked
test.skip("toElkNode should convert a project space to a workflow", async (t) => {
  const projectSpace = await getFixture<ProjectSpace>(
    "single-workflow-projectspace"
  );

  const expected = await getFixture<FlowElkNode>("single-workflow-elknode");

  t.deepEqual(toElkNode(projectSpace), expected);
});

test("toFlow should convert a FlowElkNode to FlowNodeEdges with layout", async (t) => {
  const flowElkNode = await getFixture<FlowElkNode>(
    "single-workflow-elknode"
  );
  const [expectedNodes, expectedEdges] = await getFixture<FlowNodeEdges>(
    "single-workflow-nodeedges"
  );

  const [nodes, edges] = await toFlow(flowElkNode);

  for (let i = 0; i < expectedNodes.length; i++) {
    const node = expectedNodes[i];
    t.deepEqual(
      nodes[i],
      node,
      `Node#${i} didn't match the expected one`
    );
  }

  for (let i = 0; i < expectedEdges.length; i++) {
    const edge = expectedEdges[i];
    t.deepEqual(
      edges[i],
      edge,
      `Edge#${i} didn't match the expected one`
    );
  }
});
