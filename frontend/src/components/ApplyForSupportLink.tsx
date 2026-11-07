import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApplicantViewModal } from "./ApplicantViewModal";

type Props = {
  applicantProfileId: string;
  label?: string;
  className?: string;
};

/**
 * Yearly requests follow the same path as a first-time request: review the applicant
 * dossier, then proceed to the application form to choose this year's support.
 */
export function ApplyForSupportLink({
  applicantProfileId,
  label = "Apply",
  className = "text-sm font-bold text-info hover:underline",
}: Props) {
  const navigate = useNavigate();
  const [reviewing, setReviewing] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setReviewing(true)}>
        {label}
      </button>
      {reviewing && (
        <ApplicantViewModal
          applicantId={applicantProfileId}
          proceedFlow
          onClose={() => setReviewing(false)}
          onProceedApplication={() => {
            setReviewing(false);
            navigate(`/apply?applicantId=${encodeURIComponent(applicantProfileId)}`);
          }}
        />
      )}
    </>
  );
}
