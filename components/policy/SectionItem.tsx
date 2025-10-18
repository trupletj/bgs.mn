import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ClauseItem } from "./ClauseItem";
import { Section } from "@/types/types";

interface SectionItemProps {
  section: Section;
  sectionIndex: number;
  updateSectionText: (sectionIndex: number, text: string) => void;
  addClause: (sectionIndex: number) => void;
  insertSectionBefore: (sectionIndex: number) => void;
  deleteSection: (sectionIndex: number) => void;
  updateClauseText: (
    sectionIndex: number,
    path: number[],
    text: string
  ) => void;
  addSubClause: (sectionIndex: number, path: number[]) => void;
  insertClauseBefore: (sectionIndex: number, path: number[]) => void;
  deleteClause: (sectionIndex: number, path: number[]) => void;
  isProcessing: boolean;
}

export const SectionItem = ({
  section,
  sectionIndex,
  updateSectionText,
  addClause,
  insertSectionBefore,
  deleteSection,
  updateClauseText,
  addSubClause,
  insertClauseBefore,
  deleteClause,
  isProcessing,
}: SectionItemProps) => {
  return (
    <div>
      {sectionIndex > 0 && (
        <Button
          type="button"
          variant="link"
          onClick={() => insertSectionBefore(sectionIndex)}
          disabled={isProcessing}
          className="mb-2"
          aria-label="Бүлэг нэмэх (өмнө)">
          + Бүлэг нэмэх (өмнө)
        </Button>
      )}
      <div className="mt-4 p-4 border rounded">
        <div className="flex items-center gap-4">
          <span className="font-bold">{section.reference_number}.</span>
          <Textarea
            value={section.text}
            onChange={(e) => updateSectionText(sectionIndex, e.target.value)}
            placeholder="Бүлгийн текст оруулна уу"
            className="flex-1 p-2 border rounded"
            disabled={isProcessing}
          />
          <Button
            type="button"
            variant="destructive"
            onClick={() => deleteSection(sectionIndex)}
            disabled={isProcessing}
            aria-label="Бүлэг устгах">
            - Устгах
          </Button>
        </div>

        <div className="ml-6 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Заалтууд</h3>
            <Button
              type="button"
              variant="link"
              onClick={() => addClause(sectionIndex)}
              disabled={isProcessing}
              aria-label="Заалт нэмэх">
              + Заалт нэмэх
            </Button>
          </div>

          {section.clause.map((clause, clauseIndex) => (
            <ClauseItem
              key={clause.id || `${sectionIndex}-${clauseIndex}`}
              sectionIndex={sectionIndex}
              clause={clause}
              path={[clauseIndex]}
              updateClauseText={updateClauseText}
              addSubClause={addSubClause}
              insertClauseBefore={insertClauseBefore}
              deleteClause={deleteClause}
              isProcessing={isProcessing}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
