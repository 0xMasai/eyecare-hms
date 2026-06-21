import WardPage from "./WardPage";

export default function FemaleWard({ clinicId, userProfile }) {
  return <WardPage clinicId={clinicId} userProfile={userProfile} wardType="female" />;
}
