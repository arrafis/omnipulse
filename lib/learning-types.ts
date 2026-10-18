export type LearningCategory='AI'|'Technology'|'Finance';
export type LearningLevel='Beginner'|'Intermediate'|'Advanced';
export type Reference={label:string;url:string};
export type TeachingGuide={why:string;terms:[string,string][];steps:[string,string][];walkthrough:string[];practice:{question:string;answer:string}};
export type Lesson={slug:string;title:string;category:LearningCategory;level:LearningLevel;definition:string;
 explanation:string;example:string;pitfall:string;question:string;answer:string;prerequisites:string[];sources:Reference[];added?:string;reason?:string;guide?:TeachingGuide};
export const learningCategories:LearningCategory[]=['AI','Technology','Finance'];
export const learningLevels:LearningLevel[]=['Beginner','Intermediate','Advanced'];
export function readingMinutes(text:string){return Math.max(1,Math.ceil(text.trim().split(/\s+/).length/200));}
export function lessonText(lesson:Lesson):string{return [lesson.title,lesson.definition,lesson.explanation,lesson.example,lesson.pitfall,lesson.question,lesson.answer,lesson.guide?.why,...(lesson.guide?.terms.flat()||[]),...(lesson.guide?.steps.flat()||[]),...(lesson.guide?.walkthrough||[]),lesson.guide?.practice.question,lesson.guide?.practice.answer].filter(Boolean).join(' ');}
