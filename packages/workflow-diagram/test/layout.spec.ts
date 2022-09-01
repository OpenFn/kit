import { assert } from "chai";
import { describe } from "mocha";
import { ProjectSpace } from "../dist/types";
import { toElkNode, toFlow } from "../src/layout/index";
import { FlowElkNode, FlowNodeEdges } from "../src/layout/types";
import { getFixture } from "./helpers";

describe("toElkNode", () => {
  it("should convert a project space to a workflow", async () => {
    const projectSpace = await getFixture<ProjectSpace>(
      "single-workflow-projectspace"
    );

    const expected = await getFixture<FlowElkNode>("single-workflow-elknode");

    assert.deepEqual(toElkNode(projectSpace), expected);
  });
});

describe("toFlow", () => {
  it("should convert a FlowElkNode to FlowNodeEdges with layout", async () => {
    const flowElkNode = await getFixture<FlowElkNode>(
      "single-workflow-elknode"
    );
    const [expectedNodes, expectedEdges] = await getFixture<FlowNodeEdges>(
      "single-workflow-nodeedges"
    );

    const [nodes, edges] = await toFlow(flowElkNode);

    for (let i = 0; i < expectedNodes.length; i++) {
      const node = expectedNodes[i];
      assert.deepEqual(
        nodes[i],
        node,
        `Node#${i} didn't match the expected one`
      );
    }

    for (let i = 0; i < expectedEdges.length; i++) {
      const edge = expectedEdges[i];
      assert.deepEqual(
        edges[i],
        edge,
        `Edge#${i} didn't match the expected one`
      );
    }
  });
});
