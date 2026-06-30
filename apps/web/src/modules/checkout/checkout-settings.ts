export type CheckoutFieldSetting = {
  label: string;
  placeholder: string;
  required: boolean;
  visible: boolean;
};

export type CheckoutSettings = {
  confirmButtonText: string;
  description: string;
  fields: {
    deliveryArea: CheckoutFieldSetting;
    fullAddress: CheckoutFieldSetting;
    fullName: CheckoutFieldSetting;
    mobileNumber: CheckoutFieldSetting;
  };
  title: string;
};

export const defaultCheckoutSettings: CheckoutSettings = {
  confirmButtonText: "Confirm Order",
  description: "Fast checkout with only the essentials needed to deliver your order.",
  fields: {
    deliveryArea: {
      label: "Delivery Area",
      placeholder: "Enter your delivery area",
      required: true,
      visible: true
    },
    fullAddress: {
      label: "Full Address",
      placeholder: "House, road, area, landmark",
      required: true,
      visible: true
    },
    fullName: {
      label: "Full Name",
      placeholder: "Enter your full name",
      required: true,
      visible: true
    },
    mobileNumber: {
      label: "Mobile Number",
      placeholder: "01XXXXXXXXX",
      required: true,
      visible: true
    }
  },
  title: "Checkout"
};
