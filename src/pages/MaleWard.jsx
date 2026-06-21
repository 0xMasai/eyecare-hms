import WardPage from "./WardPage";

export default function MaleWard({ clinicId, userProfile }) {
  return <WardPage clinicId={clinicId} userProfile={userProfile} wardType="male" />;
}
