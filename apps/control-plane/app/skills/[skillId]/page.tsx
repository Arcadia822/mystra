import { SkillLibrary } from "../_components/skill-library";

export default async function SkillDetailPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = await params;
  return <SkillLibrary initialSkillId={skillId} />;
}
