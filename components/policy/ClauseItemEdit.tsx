import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clause } from "@/types/clause";
import { ActionType } from "@/types/types";

interface ClauseItemProps {
  sectionIndex: number;
  clause: Clause;
  clauseIndex: number;
  path: number[];
  updateClauseText: (
    sectionIndex: number,
    path: number[],
    text: string
  ) => void;
  updateClausePositions: (
    sectionIndex: number,
    path: number[],
    positions: { positionId: string; type: ActionType }[]
  ) => void;
  addSubClause: (sectionIndex: number, path: number[]) => void;
  insertClauseBefore: (sectionIndex: number, path: number[]) => void;
  deleteClause: (sectionIndex: number, path: number[]) => void;
  parentRefNumber: string;
  level?: number;
  isProcessing: boolean;
}

export default function ClauseItem({
  sectionIndex,
  clause,
  path,
  updateClauseText,
  updateClausePositions,
  addSubClause,
  insertClauseBefore,
  deleteClause,
  level = 1,
  isProcessing,
}: ClauseItemProps) {
  return (
    <div className={`mt-2 p-2 border rounded ml-${level * 4}`}>
      <div className="flex items-center gap-4">
        <span className="font-bold">{clause.referenceNumber}.</span>
        <Textarea
          value={clause.text}
          onChange={(e) => updateClauseText(sectionIndex, path, e.target.value)}
          placeholder="Заалтын текст оруулна уу"
          className="flex-1 p-2 border rounded"
          disabled={isProcessing}
        />
        <Button
          type="button"
          variant="link"
          onClick={() => insertClauseBefore(sectionIndex, path)}
          disabled={isProcessing}
          aria-label="Заалт нэмэх (өмнө)">
          + Заалт (өмнө)
        </Button>
        {level < 4 && (
          <Button
            type="button"
            variant="link"
            onClick={() => addSubClause(sectionIndex, path)}
            disabled={isProcessing}
            aria-label="Дэд заалт нэмэх">
            + Дэд заалт
          </Button>
        )}
        <Button
          type="button"
          variant="destructive"
          onClick={() => deleteClause(sectionIndex, path)}
          disabled={isProcessing}
          aria-label="Заалт устгах">
          - Устгах
        </Button>
      </div>
      {clause.children && clause.children.length > 0 && (
        <div className="ml-6 mt-2">
          {clause.children.map((subClause, subClauseIndex) => (
            <ClauseItem
              key={
                subClause.id ||
                `${sectionIndex}-${path.join("-")}-${subClauseIndex}`
              }
              sectionIndex={sectionIndex}
              clause={subClause}
              clauseIndex={subClauseIndex}
              path={[...path, subClauseIndex]}
              updateClauseText={updateClauseText}
              updateClausePositions={updateClausePositions}
              addSubClause={addSubClause}
              insertClauseBefore={insertClauseBefore}
              deleteClause={deleteClause}
              parentRefNumber={subClause.referenceNumber}
              level={level + 1}
              isProcessing={isProcessing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
