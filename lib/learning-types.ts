export type LearningCategory='AI'|'Technology'|'Finance';
export type LearningLevel='Beginner'|'Intermediate'|'Advanced';
export type Reference={label:string;url:string};
export type Lesson={slug:string;title:string;category:LearningCategory;level:LearningLevel;definition:string;
 explanation:string;example:string;pitfall:string;question:string;answer:string;prerequisites:string[];sources:Reference[];added?:string;reason?:string};
export const learningCategories:LearningCategory[]=['AI','Technology','Finance'];
export const learningLevels:LearningLevel[]=['Beginner','Intermediate','Advanced'];
export function readingMinutes(text:string){return Math.max(1,Math.ceil(text.trim().split(/\s+/).length/200));}
