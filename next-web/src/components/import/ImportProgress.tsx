// src/components/import/ImportProgress.tsx
import { Progress } from "@/components/ui/progress"
import { CheckCircle2 } from "lucide-react"

interface ImportProgressProps {
    currentStep: 1 | 2 | 3 | 4;
}

const steps = [
    { num: 1, label: 'העלאת קובץ' },
    { num: 2, label: 'מיפוי עמודות' },
    { num: 3, label: 'תצוגה מקדימה' },
    { num: 4, label: 'תוצאות' }
];

export function ImportProgress({ currentStep }: ImportProgressProps) {
    const progressValue = ((currentStep - 1) / (steps.length - 1)) * 100;

    return (
        <div className="w-full mb-8">
            <div className="flex justify-between mb-2">
                {steps.map((step) => {
                    const isCompleted = currentStep > step.num;
                    const isCurrent = currentStep === step.num;

                    return (
                        <div
                            key={step.num}
                            className={`flex flex-col items-center flex-1 ${isCurrent ? 'text-primary font-medium' :
                                    isCompleted ? 'text-primary' : 'text-muted-foreground'
                                }`}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 border-2 transition-colors ${isCompleted ? 'bg-primary border-primary text-primary-foreground' :
                                        isCurrent ? 'border-primary bg-background text-primary' :
                                            'border-muted text-muted-foreground bg-background'
                                    }`}
                            >
                                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : step.num}
                            </div>
                            <span className="text-sm text-center">{step.label}</span>
                        </div>
                    );
                })}
            </div>

            <div className="relative pt-1">
                <Progress value={progressValue} className="h-2" />
            </div>
        </div>
    );
}
