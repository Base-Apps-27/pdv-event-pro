import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/components/utils/i18n";
import MissingFieldsForm from "@/components/event/MissingFieldsForm";

export default function AIProposalReview({
  isOpen,
  proposedActions,
  validation,
  onApprove,
  onCancel,
  isExecuting
}) {
  const { language, t } = useLanguage();
  const [expandedActions, setExpandedActions] = React.useState({});
  const [isDraft, setIsDraft] = React.useState(false);
  const [filledValues, setFilledValues] = React.useState({});

  const toggleExpanded = (idx) => {
    setExpandedActions(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleFieldChange = (actionIndex, segmentIndex, field, value) => {
    const key = `${actionIndex}-${segmentIndex}-${field}`;
    setFilledValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApprove = () => {
    // Merge filled values into proposedActions before calling onApprove
    if (filledValues && Object.keys(filledValues).length > 0) {
      const updatedActions = JSON.parse(JSON.stringify(proposedActions.actions));
      
      Object.entries(filledValues).forEach(([key, value]) => {
        const [actionIndex, segmentIndex, field] = key.split('-');
        const aIdx = parseInt(actionIndex);
        const sIdx = parseInt(segmentIndex);
        
        if (updatedActions[aIdx]?.create_data?.[sIdx]) {
          updatedActions[aIdx].create_data[sIdx][field] = value;
        }
      });

      // Call onApprove with merged data
      onApprove(updatedActions, isDraft);
    } else {
      onApprove(proposedActions.actions, isDraft);
    }
  };

  if (!proposedActions || !isOpen) return null;

  const hasErrors = validation?.errors?.length > 0;
  const hasWarnings = validation?.warnings?.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {language === 'es' ? 'Revisar Cambios Propuestos' : 'Review Proposed Changes'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Missing Fields Form */}
          {hasErrors && validation?.fixableErrors?.length > 0 && (
            <MissingFieldsForm
              fixableErrors={validation.fixableErrors}
              proposedActions={proposedActions}
              onFieldChange={handleFieldChange}
              onDraftToggle={setIsDraft}
              isDraft={isDraft}
            />
          )}

          {/* Validation Messages */}
          {(hasErrors || hasWarnings) && (
            <div className="space-y-2">
              {hasErrors && (
                <Card className="p-4 bg-red-50 border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-red-900 text-sm mb-2">
                        {language === 'es' ? 'Errores de Validación' : 'Validation Errors'}
                      </h4>
                      <ul className="text-red-800 text-xs space-y-1">
                        {validation.errors.map((err, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-red-600">✗</span>
                            <span className="break-words">{err}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              )}

              {hasWarnings && !hasErrors && (
                <Card className="p-4 bg-amber-50 border-amber-200">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-amber-900 text-sm mb-2">
                        {language === 'es' ? 'Advertencias' : 'Warnings'}
                      </h4>
                      <ul className="text-amber-800 text-xs space-y-1">
                        {validation.warnings.map((warn, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-amber-600">⚠</span>
                            <span className="break-words">{warn}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* No Errors / Ready to Execute */}
          {!hasErrors && (
            <Card className="p-3 bg-green-50 border-green-200">
              <div className="flex items-center gap-2 text-green-900 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>
                  {language === 'es' ? 'Validación correcta' : 'Validation passed'}
                </span>
              </div>
            </Card>
          )}

          {/* Actions Summary */}
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900 text-sm">
              {language === 'es' ? 'Cambios a aplicar' : 'Changes to apply'}
            </h4>

            {proposedActions.actions?.map((action, idx) => {
              const isExpanded = expandedActions[idx];
              const displayType = action.type.replace('_', ' ').toUpperCase();

              return (
                <Card key={idx} className="overflow-hidden border-gray-200">
                  {/* Action Header (Always Visible) */}
                  <button
                    onClick={() => toggleExpanded(idx)}
                    className="w-full p-3 flex items-center gap-2 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {action.description}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <Badge variant="outline" className="text-xs bg-gray-50">
                          {displayType}
                        </Badge>
                        {action.affected_count !== undefined && (
                          <Badge variant="outline" className="text-xs bg-gray-50">
                            {language === 'es' ? 'Afecta' : 'Affects'}: {action.affected_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>

                  {/* Action Details (Expandable on Mobile) */}
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-gray-200 bg-gray-50 space-y-2 text-xs">
                      {action.changes && Object.keys(action.changes).length > 0 && (
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">
                            {language === 'es' ? 'Cambios' : 'Changes'}:
                          </p>
                          <div className="bg-white p-2 rounded border border-gray-200 font-mono text-xs space-y-1 overflow-x-auto">
                            {Object.entries(action.changes).map(([k, v]) => (
                              <div key={k} className="text-gray-700">
                                <span className="text-purple-600">{k}</span>
                                <span className="text-gray-600">: </span>
                                <span className="text-green-600">"{String(v)}"</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {action.create_data && action.create_data.length > 0 && (
                        <div>
                          <p className="font-semibold text-gray-700 mb-1">
                            {language === 'es' ? 'Nuevos registros' : 'New records'}:
                          </p>
                          <div className="bg-white p-2 rounded border border-gray-200 space-y-2 max-h-48 overflow-y-auto">
                            {action.create_data.map((item, itemIdx) => (
                              <div key={itemIdx} className="border-l-2 border-blue-300 pl-2 py-1">
                                <p className="text-gray-700 font-semibold text-xs">
                                  {item.title || item.name || `Item ${itemIdx + 1}`}
                                </p>
                                <div className="text-gray-600 text-xs space-y-0.5 mt-1">
                                  {Object.entries(item).map(([k, v]) => {
                                    if (k === 'title' || k === 'name') return null;
                                    return (
                                      <div key={k}>
                                        <span className="text-purple-600">{k}</span>: <span className="text-green-600">{String(v).substring(0, 50)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {action.target_ids && (
                        <div>
                          <p className="font-semibold text-gray-700">
                            {language === 'es' ? 'Registros afectados' : 'Affected records'}:
                          </p>
                          <p className="text-gray-600">
                            {action.target_ids === 'all'
                              ? language === 'es' ? 'Todos los registros' : 'All records'
                              : Array.isArray(action.target_ids)
                                ? action.target_ids.join(', ')
                                : String(action.target_ids)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isExecuting}
              className="flex-1"
            >
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>

            <Button
              onClick={handleApprove}
              disabled={(hasErrors && !isDraft) || isExecuting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {isExecuting ? (
                <>
                  <span className="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {language === 'es' ? 'Aplicando...' : 'Applying...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {language === 'es' ? 'Confirmar y Ejecutar' : 'Confirm & Execute'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}