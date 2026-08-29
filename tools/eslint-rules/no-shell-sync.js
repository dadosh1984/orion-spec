// ponytail: only shell:true is security-critical; sync blocking is style, not security — skip
export default {
  meta: { type: "problem", docs: { description: "forbid shell:true in child_process" } },
  create(ctx) {
    return {
      Property(node) {
        if (node.key.type === "Identifier" && node.key.name === "shell" && node.value.type === "Literal" && node.value.value === true) {
          ctx.report({ node, message: "shell:true is forbidden — use argv-safe spawn without shell." });
        }
      },
    };
  },
};
