<?php
class ControllerApiUnisoukStock extends Controller {
	private function respond($json) {
		$this->response->addHeader('Content-Type: application/json');
		$this->response->setOutput(json_encode($json));
	}

	private function requireApiSession() {
		$this->load->language('api/unisouk/stock');

		if (!isset($this->session->data['api_id'])) {
			$this->respond(array('error' => $this->language->get('error_permission')));
			return false;
		}

		return true;
	}

	private function getProductQuantity($product_id) {
		$query = $this->db->query("SELECT quantity FROM `" . DB_PREFIX . "product` WHERE product_id = '" . (int)$product_id . "' LIMIT 1");
		return $query->num_rows ? (int)$query->row['quantity'] : null;
	}

	private function getVariantQuantity($product_id, $option_value_id) {
		$query = $this->db->query("SELECT quantity FROM `" . DB_PREFIX . "product_option_value` WHERE product_id = '" . (int)$product_id . "' AND product_option_value_id = '" . (int)$option_value_id . "' LIMIT 1");
		return $query->num_rows ? (int)$query->row['quantity'] : null;
	}

	public function info() {
		if (!$this->requireApiSession()) {
			return;
		}

		if (empty($this->request->post['product_id'])) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		$product_id = (int)$this->request->post['product_id'];

		if (!empty($this->request->post['option_value_id'])) {
			$option_value_id = (int)$this->request->post['option_value_id'];
			$quantity = $this->getVariantQuantity($product_id, $option_value_id);

			if ($quantity === null) {
				$this->respond(array('error' => $this->language->get('error_not_found')));
				return;
			}

			$this->respond(array(
				'success' => true,
				'data'    => array(
					'product_id'      => $product_id,
					'option_value_id' => $option_value_id,
					'quantity'        => $quantity,
				),
			));
			return;
		}

		$quantity = $this->getProductQuantity($product_id);

		if ($quantity === null) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		$this->respond(array(
			'success' => true,
			'data'    => array(
				'product_id' => $product_id,
				'quantity'   => $quantity,
			),
		));
	}

	public function edit() {
		if (!$this->requireApiSession()) {
			return;
		}

		if (empty($this->request->post['product_id']) || !isset($this->request->post['quantity'])) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		$product_id = (int)$this->request->post['product_id'];
		$new_quantity = (int)$this->request->post['quantity'];

		if (!empty($this->request->post['option_value_id'])) {
			$option_value_id = (int)$this->request->post['option_value_id'];
			$current = $this->getVariantQuantity($product_id, $option_value_id);

			if ($current === null) {
				$this->respond(array('error' => $this->language->get('error_not_found')));
				return;
			}

			if ($new_quantity < 0) {
				$this->respond(array('error' => $this->language->get('error_insufficient_stock')));
				return;
			}

			$this->db->query("UPDATE `" . DB_PREFIX . "product_option_value` SET quantity = '" . (int)$new_quantity . "' WHERE product_id = '" . (int)$product_id . "' AND product_option_value_id = '" . (int)$option_value_id . "'");

			$this->respond(array(
				'success' => true,
				'data'    => array(
					'product_id'      => $product_id,
					'option_value_id' => $option_value_id,
					'quantity'        => $new_quantity,
				),
			));
			return;
		}

		$current = $this->getProductQuantity($product_id);

		if ($current === null) {
			$this->respond(array('error' => $this->language->get('error_not_found')));
			return;
		}

		if ($new_quantity < 0) {
			$this->respond(array('error' => $this->language->get('error_insufficient_stock')));
			return;
		}

		$this->db->query("UPDATE `" . DB_PREFIX . "product` SET quantity = '" . (int)$new_quantity . "' WHERE product_id = '" . (int)$product_id . "'");

		$this->respond(array(
			'success' => true,
			'data'    => array(
				'product_id' => $product_id,
				'quantity'   => $new_quantity,
			),
		));
	}

	public function alerts() {
		if (!$this->requireApiSession()) {
			return;
		}

		$threshold = isset($this->request->post['threshold']) ? (int)$this->request->post['threshold'] : 10;

		$query = $this->db->query("SELECT p.product_id, pd.name, p.model, p.quantity FROM `" . DB_PREFIX . "product` p LEFT JOIN `" . DB_PREFIX . "product_description` pd ON (p.product_id = pd.product_id AND pd.language_id = '" . (int)$this->config->get('config_language_id') . "') WHERE p.quantity < '" . (int)$threshold . "' ORDER BY p.quantity ASC");

		$alerts = array();

		foreach ($query->rows as $row) {
			$alerts[] = array(
				'product_id' => (int)$row['product_id'],
				'name'       => $row['name'],
				'model'      => $row['model'],
				'quantity'   => (int)$row['quantity'],
				'threshold'  => $threshold,
			);
		}

		$this->respond(array(
			'success' => true,
			'data'    => array(
				'alerts' => $alerts,
			),
		));
	}
}
