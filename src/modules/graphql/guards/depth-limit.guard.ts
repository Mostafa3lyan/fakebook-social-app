import {
  type ASTVisitor,
  GraphQLError,
  Kind,
  type OperationDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
  type ValidationRule,
} from "graphql";

export const depthLimit = (maxDepth: number = 6): ValidationRule => {
  return (context: ValidationContext): ASTVisitor => {
    const checkDepth = (
      selectionSet: SelectionSetNode | undefined,
      currentDepth: number,
      node: OperationDefinitionNode,
    ): void => {
      if (!selectionSet?.selections) return;

      if (currentDepth > maxDepth) {
        context.reportError(
          new GraphQLError(
            `Operation '${node.name?.value || "unnamed"}' exceeds maximum query depth of ${maxDepth}.`,
            { nodes: [node] },
          ),
        );
        return;
      }

      for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
          if (selection.selectionSet) {
            checkDepth(selection.selectionSet, currentDepth + 1, node);
          }
        } else if (
          selection.kind === Kind.INLINE_FRAGMENT &&
          selection.selectionSet
        ) {
          checkDepth(selection.selectionSet, currentDepth, node);
        }
      }
    };

    return {
      OperationDefinition(node) {
        checkDepth(node.selectionSet, 1, node);
      },
    };
  };
};
